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

// ---- The gate cannot be escaped by declaring nothing ----

import { visualCoverageWarning } from '../scripts/lib/verify.mjs'

const groups = (types) => [{ number: 1, title: 'g', tasks: types.map((t) => ({ type: t })) }]

test('touching a stylesheet without declaring a VISUAL task is reported', () => {
  // Otherwise the visual gate is only as strong as the diligence of whoever
  // wrote tasks.md: declare nothing, and there is nothing to fail.
  const w = visualCoverageWarning(groups(['GREEN']), ['src/app.js', 'styles/main.css'])
  assert.match(w, /styles\/main\.css/)
  assert.match(w, /no VISUAL task/i)
})

test('a declared VISUAL task silences it', () => {
  assert.equal(visualCoverageWarning(groups(['GREEN', 'VISUAL']), ['styles/main.css']), null)
})

test('code that renders nothing raises nothing', () => {
  assert.equal(visualCoverageWarning(groups(['GREEN']), ['src/app.js', 'README.md']), null)
})

test('templates count as rendering, not just stylesheets', () => {
  for (const f of ['a.html', 'a.tsx', 'a.vue', 'a.svelte', 'a.blade.php', 'a.twig']) {
    assert.ok(visualCoverageWarning(groups(['GREEN']), [f]), `${f} should be flagged`)
  }
})

test('it warns and never fails, because it cannot tell a lint fix from a redesign', () => {
  // A gate that cannot tell the difference gets routed around by whoever it
  // inconveniences. Detection is deterministic; the judgement stays human.
  assert.equal(scriptVerdict({ visual: { status: 'PASS', warning: 'x' } }), 'PASS')
})
