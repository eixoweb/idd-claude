import { test } from 'vitest'
import assert from 'node:assert/strict'
import { ALL_DIMENSIONS, readVerification } from '../scripts/lib/config.mjs'

const base = `
schema: idd-claude
verification:
  spec_as_source: false
  visual: true
  mutation: false
  subagents: true
  floors: { spec: 80, runtime: 100, visual: 100, code: 60, mutation: 70, acceptance: 100 }
  max_iterations: 5
  evaluator_model: sonnet
`

test('spec and code are always enabled', () => {
  const { enabled } = readVerification('verification:\n  runtime: false\n')
  assert.ok(enabled.includes('spec'))
  assert.ok(enabled.includes('code'))
})

test('runtime is enabled when the flag is absent', () => {
  assert.ok(readVerification('verification: {}').enabled.includes('runtime'))
})

test('runtime: false removes the dimension', () => {
  const { enabled } = readVerification('verification:\n  runtime: false\n')
  assert.ok(!enabled.includes('runtime'), 'an opted-out project must not be scored on runtime')
})

test('runtime: true is accepted explicitly', () => {
  assert.ok(readVerification('verification:\n  runtime: true\n').enabled.includes('runtime'))
})

test('visual, mutation and acceptance follow their flags', () => {
  const { enabled } = readVerification(base)
  assert.ok(enabled.includes('visual'), 'visual: true must enable the dimension')
  assert.ok(!enabled.includes('mutation'), 'mutation: false must disable it')
  assert.ok(!enabled.includes('acceptance'), 'spec_as_source: false must disable acceptance')
})

test('spec_as_source drives the acceptance dimension', () => {
  const { enabled } = readVerification('verification:\n  spec_as_source: true\n')
  assert.ok(enabled.includes('acceptance'))
})

test('floors fall back to the documented defaults', () => {
  const { floors } = readVerification('verification: {}')
  assert.equal(floors.runtime, 100)
  assert.equal(floors.visual, 100)
  assert.equal(floors.spec, 80)
  assert.equal(floors.code, 60)
  assert.equal(floors.mutation, 70)
})

test('a floor outside 0-100 is rejected loudly', () => {
  assert.throws(
    () => readVerification('verification:\n  floors: { spec: 120 }\n'),
    /floor for "spec"/,
    'an out-of-range floor must name the dimension',
  )
})

test('an unknown dimension in floors is rejected', () => {
  assert.throws(
    () => readVerification('verification:\n  floors: { speed: 50 }\n'),
    /unknown dimension "speed"/,
  )
})

test('every dimension has a declared floor', () => {
  const { floors } = readVerification(base)
  for (const dimension of ALL_DIMENSIONS) {
    assert.equal(typeof floors[dimension], 'number', `${dimension} has no floor`)
  }
})

test('operational settings come through with defaults', () => {
  const settings = readVerification('verification: {}')
  assert.equal(settings.maxIterations, 5)
  assert.equal(settings.evaluatorModel, 'sonnet')
})

test('execution shape is not a project setting', () => {
  // How the work runs — subagents, worktree — varies per change, and the tier
  // from /idd:explore already says it. Freezing it project-wide answered a
  // per-change question in the wrong place.
  const settings = readVerification('verification:\n  worktree: true\n  subagents: false\n')
  assert.equal(settings.worktree, undefined)
  assert.equal(settings.subagents, undefined)
})

test('the config carries only project facts and policy', () => {
  const settings = readVerification('verification: {}')
  assert.deepEqual(
    Object.keys(settings).sort(),
    ['enabled', 'evaluatorModel', 'floors', 'maxIterations'],
  )
})
