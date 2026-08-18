#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { changeDiff } from './lib/change-diff.mjs'
import { readProject, readVerification } from './lib/config.mjs'
import { parseTasks } from './lib/tasks.mjs'
import { scriptVerdict, visualCoverageWarning } from './lib/verify.mjs'
import { buildProbeScript, evaluateVisualBatch, parseVisualSpec } from './lib/visual.mjs'

const [changeId, projectRoot = process.cwd()] = process.argv.slice(2)
if (!changeId) {
  console.error('usage: verify-cli.mjs <changeId> [projectRoot]')
  process.exit(2)
}

const here = dirname(fileURLToPath(import.meta.url))
const changeDir = join(projectRoot, 'openspec', 'changes', changeId)
const config = readFileSync(join(projectRoot, 'openspec', 'config.yaml'), 'utf8')
const { enabled, mutationThreshold } = readVerification(config)
const project = readProject(config)
const groups = parseTasks(readFileSync(join(changeDir, 'tasks.md'), 'utf8'))

const firstLine = (error) =>
  String(error.stderr ?? error.message)
    .replace(/\[[0-9;]*m/g, '')
    .trim()
    .split('\n')[0]

// Every mechanical dimension in one command. Four separate invocations meant
// four tool round trips, each costing the model far more than the command it
// wrapped — the measurement that motivated batching the visual probes.
const dimensions = {}

if (enabled.includes('runtime')) {
  const failed = []
  for (const command of project.testCommands) {
    try {
      execSync(command, { cwd: projectRoot, stdio: 'pipe', encoding: 'utf8' })
    } catch (error) {
      failed.push({ command, error: firstLine(error) })
    }
  }
  dimensions.runtime = failed.length
    ? { status: 'FAIL', failed }
    : { status: 'PASS', commands: project.testCommands }
}

if (enabled.includes('visual')) {
  const tasks = groups.flatMap((group) =>
    group.tasks.filter((task) => task.type === 'VISUAL').map((task) => task),
  )
  if (tasks.length === 0) {
    // No VISUAL task is not a pass by omission: say whether the change rendered
    // anything it made no claim about.
    const warning = visualCoverageWarning(groups, changeDiff(changeId, projectRoot).changedFiles)
    dimensions.visual = { status: 'PASS', note: 'no VISUAL task in this change', warning }
  } else {
    const specs = tasks.map((t) => ({ ...parseVisualSpec(t.lines), ordinal: t.ordinal }))
    try {
      const out = execFileSync(
        'dev-browser',
        ['--ignore-https-errors', '--headless', '--timeout', '30'],
        { input: buildProbeScript(specs, project.devStackUrl), encoding: 'utf8' },
      )
      const { measuredByTask } = JSON.parse(out.trim().split('\n').at(-1))
      const result = evaluateVisualBatch(specs, measuredByTask)
      dimensions.visual = { status: result.score === 100 ? 'PASS' : 'FAIL', ...result }
    } catch (error) {
      // A stack that will not answer is infrastructure, never a failing change.
      dimensions.visual = { status: 'UNKNOWN', error: firstLine(error) }
    }
  }
}

const scored = (name, script, args, judge) => {
  try {
    const out = execFileSync('node', [join(here, script), ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    const { score, error } = JSON.parse(out.trim().split('\n').at(-1))
    dimensions[name] =
      score === 'UNKNOWN' ? { status: 'UNKNOWN', error } : { status: judge(score), score }
  } catch (error) {
    dimensions[name] = { status: 'UNKNOWN', error: firstLine(error) }
  }
}

if (enabled.includes('mutation')) {
  const { base } = changeDiff(changeId, projectRoot)
  scored('mutation', 'mutation-cli.mjs', [base], (s) => (s >= mutationThreshold ? 'PASS' : 'FAIL'))
}

if (enabled.includes('acceptance')) {
  scored('acceptance', 'acceptance-cli.mjs', ['.'], (s) => (s === 100 ? 'PASS' : 'FAIL'))
}

const verdict = scriptVerdict(dimensions)
console.log(JSON.stringify({ verdict, mutationThreshold, dimensions }, null, 2))
process.exit(verdict === 'PASS' ? 0 : 1)
