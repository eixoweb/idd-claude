import { test } from 'vitest'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const extractor = join(
  pluginRoot,
  'skills/acceptance-test-authoring/references/javascript/extract-gherkin.cjs',
)
const fixture = join(pluginRoot, 'tests', 'fixtures', 'gherkin')

const extracted = () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-gherkin-'))
  cpSync(fixture, dir, { recursive: true })
  const out = join(dir, 'acceptance-tests', '.extracted')
  execFileSync('node', [extractor, join(dir, 'openspec'), out], { encoding: 'utf8' })
  return out
}

const featureIn = (out) => {
  const file = readdirSync(out, { recursive: true }).find((f) => String(f).endsWith('.feature'))
  assert.ok(file, 'no .feature file was written')
  return readFileSync(join(out, String(file)), 'utf8')
}

test('the extractor turns a fenced spec into a .feature file', () => {
  const out = extracted()
  assert.ok(existsSync(out), 'the output directory must be created')
  const features = readdirSync(out, { recursive: true }).filter((f) =>
    String(f).endsWith('.feature'),
  )
  assert.ok(features.length > 0, 'at least one .feature must be written')
})

test('headings become Feature and Scenario, fences become steps', () => {
  const feature = featureIn(extracted())

  assert.match(feature, /^Feature:/m, 'the capability heading must become a Feature')
  assert.match(feature, /Scenario: A known email receives a link/)
  assert.match(feature, /Scenario: An unknown email is silently ignored/)
  assert.match(feature, /Given a registered user/)
  assert.match(feature, /Then no email is sent/)
})

test('prose outside the fences does not leak into the steps', () => {
  const feature = featureIn(extracted())
  assert.doesNotMatch(feature, /SHALL issue a single-use link/)
  assert.doesNotMatch(feature, /```/)
})
