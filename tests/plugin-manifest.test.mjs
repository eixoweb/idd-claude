import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'))

test('plugin.json declares a name and a semver version', () => {
  const plugin = readJson('.claude-plugin/plugin.json')
  assert.equal(plugin.name, 'idd-claude')
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/)
  assert.ok(plugin.description.length > 0, 'description must not be empty')
})

test('marketplace.json lists the plugin at the repo root', () => {
  const market = readJson('.claude-plugin/marketplace.json')
  const entry = market.plugins.find((p) => p.name === 'idd-claude')
  assert.ok(entry, 'marketplace.json must list a plugin named idd-claude')
  assert.equal(entry.source, './')
})
