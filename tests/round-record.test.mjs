import { test } from 'vitest'
import assert from 'node:assert/strict'
import { renderRound, appendRound } from '../scripts/lib/round-record.mjs'

const round = {
  group: 1,
  attempt: 2,
  status: 'PASS',
  scores: { spec: 90, runtime: 100, code: 80 },
  applicable: ['spec', 'runtime', 'code'],
  carried: ['visual'],
  findings: ['code: one MEDIUM left'],
  fixTasks: [],
}

test('a round renders its scores and its status', () => {
  const md = renderRound(round)
  assert.match(md, /Group 1/)
  assert.match(md, /attempt 2/i)
  assert.match(md, /PASS/)
  assert.match(md, /spec.*90/)
})

test('a carried dimension is marked as carried, not as measured', () => {
  // A PASS has to stay readable months later: which dimensions were measured
  // in this round, and which were taken from the previous one.
  const md = renderRound(round)
  assert.match(md, /carried/i)
  assert.match(md, /visual/)
})

test('an inapplicable dimension is not reported as a score', () => {
  const md = renderRound({ ...round, applicable: ['spec', 'code'], scores: { spec: 90, code: 80 } })
  assert.doesNotMatch(md, /runtime/)
})

test('fix tasks are listed when there are any', () => {
  const md = renderRound({ ...round, status: 'RETRY', fixTasks: ['1.F1 FIX — do the thing'] })
  assert.match(md, /1\.F1 FIX/)
})

test('appending never loses an earlier round', () => {
  const first = appendRound('', { ...round, attempt: 1, status: 'BLOCK' })
  const second = appendRound(first, round)
  assert.match(second, /BLOCK/)
  assert.match(second, /PASS/)
  assert.ok(second.indexOf('BLOCK') < second.indexOf('PASS'), 'rounds stay in order')
})

test('appending to an empty record writes a heading first', () => {
  const md = appendRound('', round)
  assert.match(md, /^# Verification Report/)
})

test('appending to an existing record does not repeat the heading', () => {
  const md = appendRound(appendRound('', round), { ...round, attempt: 3 })
  assert.equal(md.match(/# Verification Report/g).length, 1)
})

test('a BLOCK round says nothing was scored, because nothing was', () => {
  // BLOCK stops before scoring. Rendering the dimensions as "measured" with a
  // dash says the opposite of what happened.
  const md = renderRound({
    group: 1,
    attempt: 1,
    status: 'BLOCK',
    scores: {},
    applicable: ['spec', 'runtime'],
    findings: ['CRITICAL: something'],
  })
  assert.doesNotMatch(md, /measured/)
  assert.match(md, /not scored/i)
  assert.match(md, /blocked before scoring/i)
})

test('a partially scored round still distinguishes the two', () => {
  const md = renderRound({
    group: 1,
    attempt: 2,
    status: 'RETRY',
    scores: { spec: 40 },
    applicable: ['spec', 'runtime'],
  })
  assert.match(md, /\| `spec` \| 40 \| measured \|/)
  assert.match(md, /\| `runtime` \| — \| not scored/)
})
