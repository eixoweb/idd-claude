import { test } from 'node:test'
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
  assert.deepEqual(JSON.parse(out), { status: 'PASS', failed: [], unevaluated: [] })
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
