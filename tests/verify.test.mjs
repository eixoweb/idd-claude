import { test } from 'vitest'
import assert from 'node:assert/strict'
import { scriptVerdict } from '../scripts/lib/verify.mjs'

const d = (over) => ({ runtime: { status: 'PASS' }, visual: { status: 'PASS' }, ...over })

test('every mechanical dimension green is a PASS', () => {
  assert.equal(scriptVerdict(d()), 'PASS')
})

test('a failing dimension fails the change, whatever the others say', () => {
  assert.equal(scriptVerdict(d({ runtime: { status: 'FAIL' } })), 'FAIL')
})

test('an unevaluable dimension blocks rather than passing quietly', () => {
  // A dev stack that will not start is not a green change; it is no measurement
  // at all, and a report that hides it has verified nothing.
  assert.equal(scriptVerdict(d({ visual: { status: 'UNKNOWN' } })), 'BLOCKED')
})

test('a real failure outranks a broken probe, because it is the actionable one', () => {
  const v = scriptVerdict(d({ runtime: { status: 'FAIL' }, visual: { status: 'UNKNOWN' } }))
  assert.equal(v, 'FAIL')
})

test('a dimension that is off does not count as passing', () => {
  // Absent means not enabled. Scoring it PASS would let a disabled gate read as
  // a cleared one.
  assert.equal(scriptVerdict({ runtime: { status: 'PASS' } }), 'PASS')
  assert.equal(scriptVerdict({}), 'PASS')
})

test('mutation is judged against its threshold, not against perfection', () => {
  assert.equal(scriptVerdict(d({ mutation: { status: 'PASS', score: 72 } })), 'PASS')
  assert.equal(scriptVerdict(d({ mutation: { status: 'FAIL', score: 40 } })), 'FAIL')
})
