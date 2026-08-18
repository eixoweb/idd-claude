import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const load = (dir) => parse(readFileSync(new URL(`${dir}/schema.yaml`, root), 'utf8'))

const full = load('schema')
const lite = load('schema-lite')
const byId = (schema) => Object.fromEntries(schema.artifacts.map((a) => [a.id, a]))
const F = byId(full)
const L = byId(lite)

// The lite schema was generated from the full one. Nothing but a test keeps
// an edit to one from failing to reach the other.
const SHARED = ['specs', 'tasks', 'verification']

test('the shared artifact instructions are identical in both schemas', () => {
  for (const id of SHARED) {
    assert.equal(L[id].instruction, F[id].instruction, `${id}: the two schemas have drifted`)
  }
})

test('the shared artifacts generate and template the same files', () => {
  for (const id of [...SHARED, 'proposal']) {
    assert.equal(L[id].generates, F[id].generates, `${id}: generates differs`)
    assert.equal(L[id].template, F[id].template, `${id}: template differs`)
  }
})

test('every shared template file is byte-identical', () => {
  for (const id of [...SHARED, 'proposal']) {
    const a = readFileSync(new URL(`schema/templates/${F[id].template}`, root), 'utf8')
    const b = readFileSync(new URL(`schema-lite/templates/${L[id].template}`, root), 'utf8')
    assert.equal(b, a, `${L[id].template}: the two copies have drifted`)
  }
})

test('the lite proposal differs from the full one only by its bounded guard', () => {
  // The one intended difference: lite warns to recreate the change with the
  // full schema if an architectural criterion turns out to apply.
  assert.ok(L.proposal.instruction.endsWith(F.proposal.instruction), 'lite must extend, not rewrite')
  const guard = L.proposal.instruction.slice(0, -F.proposal.instruction.length)
  assert.match(guard, /bounded workflow/)
  assert.match(guard, /--schema idd-claude/)
})

test('only the lite schema drops design and adr', () => {
  assert.ok(F.design && F.adr, 'the full schema keeps both')
  assert.equal(L.design, undefined)
  assert.equal(L.adr, undefined)
})
