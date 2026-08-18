#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from 'yaml'
import { parseTasks } from './lib/tasks.mjs'
import { splitDiffFiles, visualAssertionsFor, selectGroups } from './lib/evaluator-input.mjs'

const [changeId, groupArg, projectRoot = process.cwd()] = process.argv.slice(2)
if (!changeId) {
  console.error('usage: evaluator-input-cli.mjs <changeId> [groupNumber] [projectRoot]')
  process.exit(2)
}

const changeDir = join(projectRoot, 'openspec', 'changes', changeId)
const git = (...args) =>
  execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

const schema = parse(readFileSync(join(changeDir, '.openspec.yaml'), 'utf8'))?.schema
const tier = schema === 'idd-claude-lite' ? 'bounded' : 'architectural'

// The base is derivable: the commit that introduced the change folder, minus
// one. Guessing it by hand is how a diff ends up carrying unrelated history.
const introduced = git(
  'log',
  '--diff-filter=A',
  '--format=%H',
  '--',
  relative(projectRoot, join(changeDir, '.openspec.yaml')),
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .pop()
const base = introduced ? `${introduced}^` : git('rev-list', '--max-parents=0', 'HEAD').trim()

const groups = selectGroups(
  parseTasks(readFileSync(join(changeDir, 'tasks.md'), 'utf8')),
  tier,
  groupArg ?? null,
)

const changed = git('diff', '--name-only', `${base}..HEAD`).trim().split('\n').filter(Boolean)
const { code, artifacts } = splitDiffFiles(changed)

const specsDir = join(changeDir, 'specs')
const specs = existsSync(specsDir)
  ? readdirSync(specsDir, { recursive: true })
      .filter((f) => String(f).endsWith('.md'))
      .map((f) => ({ path: `specs/${f}`, content: readFileSync(join(specsDir, String(f)), 'utf8') }))
  : []

console.log(
  JSON.stringify(
    {
      changeId,
      tier,
      base,
      groups: groups.map((g) => ({
        number: g.number,
        title: g.title,
        tasks: g.tasks,
        visual: visualAssertionsFor(g),
      })),
      specs,
      changedFiles: code,
      artifactFiles: artifacts,
      // Only the code. The evaluator does not review the change's own paperwork.
      diff: code.length > 0 ? git('diff', `${base}..HEAD`, '--', ...code) : '',
    },
    null,
    2,
  ),
)
