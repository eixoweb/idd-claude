import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNKNOWN, computeVerdict } from '../scripts/lib/verdict.mjs'

const floors = { spec: 80, runtime: 100, code: 60, visual: 100, mutation: 70, acceptance: 100 }
const enabled = ['spec', 'runtime', 'code', 'visual']

test('every enabled dimension at or above its floor passes', () => {
  const v = computeVerdict({
    scores: { spec: 80, runtime: 100, code: 60, visual: 100 },
    floors,
    enabled,
  })
  assert.deepEqual(v, { status: 'PASS', failed: [], unevaluated: [] })
})

test('a single dimension below its floor forces RETRY', () => {
  const v = computeVerdict({
    scores: { spec: 95, runtime: 100, code: 90, visual: 60 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'RETRY')
  assert.deepEqual(v.failed, ['visual'])
})

test('a weak dimension is never redeemed by strong ones', () => {
  // Under the weighted total this scored 86 and passed. It must not.
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 85, visual: 60 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'RETRY')
})

test('a disabled dimension is ignored even when scored', () => {
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 90, visual: 100, mutation: 10 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'PASS')
})

test('an unevaluable dimension BLOCKS rather than RETRIES', () => {
  // Infrastructure failure is not a code defect: retrying the code is futile.
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 90, visual: UNKNOWN },
    floors,
    enabled,
  })
  assert.equal(v.status, 'BLOCK')
  assert.deepEqual(v.unevaluated, ['visual'])
})

test('BLOCK wins over RETRY when both apply', () => {
  const v = computeVerdict({
    scores: { spec: 10, runtime: 100, code: 90, visual: UNKNOWN },
    floors,
    enabled,
  })
  assert.equal(v.status, 'BLOCK')
})

test('a missing score for an enabled dimension is unevaluated, not zero', () => {
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 90 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'BLOCK')
  assert.deepEqual(v.unevaluated, ['visual'])
})
