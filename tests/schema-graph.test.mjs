import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const schema = parse(readFileSync(new URL('schema/schema.yaml', root), 'utf8'))
const byId = Object.fromEntries(schema.artifacts.map((a) => [a.id, a]))

test('schema is named idd-claude', () => {
  assert.equal(schema.name, 'idd-claude')
})

test('the artifact set is exactly the six designed artifacts', () => {
  assert.deepEqual(Object.keys(byId).sort(), [
    'adr',
    'design',
    'proposal',
    'specs',
    'tasks',
    'verification',
  ])
})

test('the dependency graph matches the design', () => {
  assert.deepEqual(byId.proposal.requires ?? [], [])
  assert.deepEqual(byId.specs.requires, ['proposal'])
  assert.deepEqual(byId.design.requires, ['proposal'])
  assert.deepEqual(byId.adr.requires, ['design'])
  assert.deepEqual([...byId.tasks.requires].sort(), ['adr', 'specs'])
  assert.deepEqual(byId.verification.requires, ['tasks'])
  assert.deepEqual(schema.apply.requires, ['tasks'])
})

test('no artifact depends on an unknown id', () => {
  for (const artifact of schema.artifacts) {
    for (const dep of artifact.requires ?? []) {
      assert.ok(byId[dep], `${artifact.id} requires unknown artifact "${dep}"`)
    }
  }
})

test('every artifact points at a template file that exists', () => {
  for (const artifact of schema.artifacts) {
    assert.ok(artifact.template, `${artifact.id} has no template`)
    const path = new URL(`schema/templates/${artifact.template}`, root)
    assert.ok(existsSync(path), `missing template for ${artifact.id}: ${artifact.template}`)
  }
})
