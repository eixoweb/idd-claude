import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  MINIMUM_OPENSPEC,
  parseVersion,
  isAtLeast,
  detectOpenspec,
} from '../scripts/lib/openspec-version.mjs'

test('parseVersion extracts the triple from CLI output', () => {
  assert.deepEqual(parseVersion('1.2.0'), { major: 1, minor: 2, patch: 0 })
  assert.deepEqual(parseVersion('1.9.0\n'), { major: 1, minor: 9, patch: 0 })
  assert.equal(parseVersion('not a version'), null)
})

test('isAtLeast compares numerically, not lexically', () => {
  // 1.10.0 sorts before 1.9.0 as a string — it must still count as newer.
  assert.equal(isAtLeast('1.10.0', '1.9.0'), true)
  assert.equal(isAtLeast('1.9.0', '1.9.0'), true)
  assert.equal(isAtLeast('1.9.1', '1.9.0'), true)
  assert.equal(isAtLeast('1.2.0', '1.9.0'), false)
  assert.equal(isAtLeast('2.0.0', '1.9.0'), true)
  assert.equal(isAtLeast('0.9.0', '1.9.0'), false)
})

test('the minimum is 1.9.0', () => {
  assert.equal(MINIMUM_OPENSPEC, '1.9.0')
})

test('detectOpenspec reports a satisfied install', () => {
  const result = detectOpenspec(() => '1.9.0\n')
  assert.deepEqual(result, { installed: true, version: '1.9.0', satisfies: true })
})

test('detectOpenspec reports an install that is too old', () => {
  const result = detectOpenspec(() => '1.2.0\n')
  assert.deepEqual(result, { installed: true, version: '1.2.0', satisfies: false })
})

test('detectOpenspec reports a missing binary instead of throwing', () => {
  const result = detectOpenspec(() => {
    throw new Error('spawn openspec ENOENT')
  })
  assert.deepEqual(result, { installed: false, version: null, satisfies: false })
})

test('detectOpenspec finds the real CLI when no runner is injected', () => {
  // The other tests inject a fake runner, so defaultRun is never executed and
  // its body goes unmutated-and-uncovered. This exercises it for real: the
  // project's own prerequisite is that openspec >= 1.9 is on PATH.
  const result = detectOpenspec()
  assert.equal(result.installed, true)
  assert.match(result.version, /^\d+\.\d+\.\d+$/)
  assert.equal(result.satisfies, true)
})
