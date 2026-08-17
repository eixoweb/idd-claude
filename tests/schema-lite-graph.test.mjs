import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const schema = parse(readFileSync(new URL('schema-lite/schema.yaml', root), 'utf8'))
const byId = Object.fromEntries(schema.artifacts.map((a) => [a.id, a]))

test('the lite schema is named idd-claude-lite', () => {
  assert.equal(schema.name, 'idd-claude-lite')
})

test('the lite schema drops design and adr', () => {
  assert.deepEqual(Object.keys(byId).sort(), ['proposal', 'specs', 'tasks', 'verification'])
})

test('the lite dependency graph is linear', () => {
  assert.deepEqual(byId.proposal.requires ?? [], [])
  assert.deepEqual(byId.specs.requires, ['proposal'])
  assert.deepEqual(byId.tasks.requires, ['specs'])
  assert.deepEqual(byId.verification.requires, ['tasks'])
  assert.deepEqual(schema.apply.requires, ['tasks'])
})

test('every lite artifact points at a template that exists', () => {
  for (const artifact of schema.artifacts) {
    assert.ok(artifact.template, `${artifact.id} has no template`)
    assert.ok(
      existsSync(new URL(`schema-lite/templates/${artifact.template}`, root)),
      `missing template for ${artifact.id}: ${artifact.template}`,
    )
  }
})
