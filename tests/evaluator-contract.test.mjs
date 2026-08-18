import { test } from 'vitest'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const cli = join(pluginRoot, 'scripts', 'verdict-cli.mjs')
const agentPath = join(pluginRoot, 'agents', 'evaluator.md')

test('the evaluator agent exists with Claude Code frontmatter', () => {
  assert.ok(existsSync(agentPath))
  const frontmatter = parseFrontmatter(readFileSync(agentPath, 'utf8'))
  assert.equal(frontmatter.name, 'evaluator')
  assert.ok(frontmatter.description?.length > 0)
  assert.ok(['haiku', 'sonnet', 'opus'].includes(frontmatter.model))
})

test('the evaluator works from the dispatch rather than fetching its inputs', () => {
  const body = readFileSync(agentPath, 'utf8').replace(/\s+/g, ' ')
  assert.match(body, /Everything you need is in the dispatch/)
  assert.match(body, /Work from what you were given/)
})

test('the evaluator prompt encodes the design rules', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /requesting-code-review/, 'it must run the code review itself')
  assert.match(body, /at a depth the diff deserves/, 'review depth must follow the diff')
  assert.match(body, /CRITICAL|HIGH/, 'it must block on critical findings without scoring')
  assert.match(body, /verdict-cli\.mjs/, 'it must not compute the verdict itself')
  assert.match(body, /re-?run|replay/i, 'it must replay the VISUAL assertions rather than trust them')
})

test('verdict-cli returns PASS for scores above the floors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')

  const out = execFileSync(
    'node',
    [cli, configPath, JSON.stringify({ spec: 90, runtime: 100, code: 80, visual: 100 })],
    { encoding: 'utf8' },
  )
  const verdict = JSON.parse(out)
  assert.equal(verdict.status, 'PASS')
  assert.deepEqual(verdict.failed, [])
  assert.deepEqual(verdict.unevaluated, [])
  assert.deepEqual(verdict.applicable.sort(), ['code', 'runtime', 'spec', 'visual'])
})

test('verdict-cli BLOCKS when an enabled dimension was not scored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')

  const out = execFileSync(
    'node',
    [cli, configPath, JSON.stringify({ spec: 90, runtime: 100, code: 80 })],
    { encoding: 'utf8' },
  )
  assert.equal(JSON.parse(out).status, 'BLOCK')
})

test('the evaluator never proposes editing the specs it measures against', () => {
  // A real run had it write the missing requirement for ungoverned work. The
  // spec and the code then came from the same round, with no human between
  // them — and the code was correct by construction.
  const body = readFileSync(agentPath, 'utf8').replace(/\s+/g, ' ')
  assert.match(body, /Do \*\*not\*\* generate a fix task that writes the missing requirement/)
  assert.match(body, /Never propose a fix task that edits the specs you are measuring against/)
  assert.match(body, /grows the spec, the other drops the code/)
})

test('a REFACTOR touching a test assertion blocks rather than scores', () => {
  // It used to cap the spec dimension at 50 — a rule that could never fire,
  // because the review catches it as CRITICAL first and BLOCK stops before any
  // scoring. Two mechanisms for one defect, and the blocking one is right.
  const body = readFileSync(agentPath, 'utf8').replace(/\s+/g, ' ')
  assert.match(body, /REFACTOR task whose diff touches a test assertion is automatically CRITICAL/)
  assert.doesNotMatch(body, /cap that dimension at 50/)
})

test('the evaluator probes the page through the CLI rather than by eye', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /visual-cli\.mjs/)
  assert.match(body, /UNKNOWN/, 'an unreachable dev stack must be UNKNOWN, not 0')
})

test('the evaluator runs the mutation tool through the CLI', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /mutation-cli\.mjs/)
  assert.match(body, /never 0|not 0/i)
})

test('the evaluator runs the acceptance suite through the CLI', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /acceptance-cli\.mjs/)
  assert.match(body, /spec_as_source/)
})

test('verdict-cli drops a dimension the group cannot exercise', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  const tasksPath = join(dir, 'tasks.md')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')
  writeFileSync(tasksPath, '## 2. No UI here\n- [ ] 2.1 RED x\n- [ ] 2.2 GREEN y\n', 'utf8')

  const out = execFileSync(
    'node',
    [cli, configPath, JSON.stringify({ spec: 90, runtime: 100, code: 80 }), tasksPath, '2'],
    { encoding: 'utf8' },
  )
  const verdict = JSON.parse(out)
  assert.equal(verdict.status, 'PASS', 'a group with no VISUAL task must not BLOCK on visual')
  assert.ok(!verdict.applicable.includes('visual'))
})

test('verdict-cli keeps the dimension when the group does exercise it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  const tasksPath = join(dir, 'tasks.md')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')
  writeFileSync(tasksPath, '## 2. UI\n- [ ] 2.1 VISUAL x\n      url: /\n      count .a  1\n', 'utf8')

  const out = execFileSync(
    'node',
    [cli, configPath, JSON.stringify({ spec: 90, runtime: 100, code: 80 }), tasksPath, '2'],
    { encoding: 'utf8' },
  )
  const verdict = JSON.parse(out)
  assert.equal(verdict.status, 'BLOCK', 'an unscored but applicable visual must block')
  assert.deepEqual(verdict.unevaluated, ['visual'])
})

test('verdict-cli warns when a group changed view files without a VISUAL task', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  const tasksPath = join(dir, 'tasks.md')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')
  writeFileSync(tasksPath, '## 3. Styling\n- [ ] 3.1 GREEN restyle\n', 'utf8')

  const out = execFileSync(
    'node',
    [
      cli,
      configPath,
      JSON.stringify({ spec: 90, runtime: 100, code: 80 }),
      tasksPath,
      '3',
      JSON.stringify(['src/app.js', 'styles/main.css']),
    ],
    { encoding: 'utf8' },
  )
  const verdict = JSON.parse(out)
  assert.equal(verdict.status, 'PASS', 'the warning must not change the verdict')
  assert.equal(verdict.warnings.length, 1)
  assert.match(verdict.warnings[0], /main\.css/)
  assert.match(verdict.warnings[0], /no VISUAL task/)
})

test('verdict-cli says which dimensions a fix could have reached', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  const tasksPath = join(dir, 'tasks.md')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')
  writeFileSync(tasksPath, '## 1. G\n- [ ] 1.1 VISUAL x\n      url: /\n      count .a  1\n', 'utf8')

  const run = (fixed) =>
    JSON.parse(
      execFileSync(
        'node',
        [
          cli,
          configPath,
          JSON.stringify({ spec: 90, runtime: 100, code: 80, visual: 100 }),
          tasksPath,
          '1',
          JSON.stringify(['index.html']),
          JSON.stringify(fixed),
        ],
        { encoding: 'utf8' },
      ),
    )

  // A fix confined to a test file cannot change what the browser renders.
  const testOnly = run(['tests/a.test.mjs'])
  assert.ok(!testOnly.recheck.includes('visual'))
  assert.ok(testOnly.recheck.includes('runtime'), 'the cheap safety net always re-runs')

  assert.ok(run(['index.html']).recheck.includes('visual'))
})

test('verdict-cli omits recheck when no fix files are given', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  writeFileSync(configPath, 'verification: {}\n', 'utf8')
  const out = JSON.parse(
    execFileSync('node', [cli, configPath, JSON.stringify({ spec: 90, runtime: 100, code: 80 })], {
      encoding: 'utf8',
    }),
  )
  assert.equal(out.recheck, undefined)
})

test('the evaluator is handed the dev stack URL it is promised', () => {
  const body = readFileSync(agentPath, 'utf8')
  // Its charter already said the dispatch carries the dev stack URL. The
  // dispatch did not, so the placeholder `<baseUrl>` was filled in by guesswork.
  assert.match(body, /devStackUrl/)
  assert.doesNotMatch(body, /<baseUrl>/)
})

test('the evaluator opens the one file it is handed', () => {
  // Reading a payload prepared for it is not "going looking": the charter bans
  // hunting through the codebase, not opening its own inputs.
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /payload/i)
  assert.match(body, /not .*going looking|is not going looking|does not count as going looking/i)
})
