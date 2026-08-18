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

test('the evaluator prompt encodes the design rules', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /requesting-code-review/, 'it must run the code review itself')
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
