import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  UNKNOWN,
  applicableDimensions,
  computeVerdict,
  dimensionsToRecheck,
  visualCoverageWarning,
} from '../scripts/lib/verdict.mjs'

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

// ---- Applicability: derived from the tasks artifact, never asserted ----

const group = (...types) => ({ number: 1, title: 'g', tasks: types.map((type) => ({ type })) })

test('visual does not apply to a group with no VISUAL task', () => {
  // Scoring it 100 would be a free pass; scoring it UNKNOWN would BLOCK every
  // non-UI group. It simply does not apply.
  assert.deepEqual(
    applicableDimensions(['spec', 'runtime', 'code', 'visual'], group('RED', 'GREEN')),
    ['spec', 'runtime', 'code'],
  )
})

test('visual applies as soon as the group has one VISUAL task', () => {
  assert.ok(
    applicableDimensions(['spec', 'visual'], group('RED', 'VISUAL')).includes('visual'),
  )
})

test('a disabled dimension stays out regardless of the tasks', () => {
  assert.deepEqual(applicableDimensions(['spec', 'code'], group('VISUAL')), ['spec', 'code'])
})

test('every other dimension applies whatever the group contains', () => {
  const all = ['spec', 'runtime', 'code', 'mutation', 'acceptance']
  assert.deepEqual(applicableDimensions(all, group('RED')), all)
})

test('without group information nothing is dropped', () => {
  // Backward compatible: a caller that cannot say which group it is gets the
  // strict behaviour, not the lenient one.
  assert.deepEqual(applicableDimensions(['spec', 'visual'], null), ['spec', 'visual'])
})

test('a group whose VISUAL task was removed loses the dimension, not a free pass', () => {
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 90 },
    floors,
    enabled: applicableDimensions(['spec', 'runtime', 'code', 'visual'], group('RED', 'GREEN')),
  })
  assert.equal(v.status, 'PASS')
  assert.deepEqual(v.unevaluated, [], 'an inapplicable dimension must not read as unevaluated')
})

// ---- Did the group touch the interface without declaring a visual claim? ----

test('a group touching view files without a VISUAL task is flagged', () => {
  const warning = visualCoverageWarning({
    changedFiles: ['src/countdown.js', 'index.html'],
    group: group('RED', 'GREEN'),
  })
  assert.ok(warning, 'a view-file change with no VISUAL task must be reported')
  assert.match(warning, /index\.html/)
})

test('no warning when the group does declare a VISUAL task', () => {
  assert.equal(
    visualCoverageWarning({ changedFiles: ['index.html'], group: group('VISUAL') }),
    null,
  )
})

test('no warning when the group touches no view file', () => {
  assert.equal(
    visualCoverageWarning({ changedFiles: ['src/a.js', 'README.md'], group: group('RED') }),
    null,
  )
})

test('the view patterns cover the usual template and style extensions', () => {
  for (const file of ['a.css', 'a.scss', 'a.vue', 'a.tsx', 'a.svelte', 'page.blade.php', 'a.twig']) {
    assert.ok(
      visualCoverageWarning({ changedFiles: [file], group: group('GREEN') }),
      `${file} should count as a view file`,
    )
  }
})

test('the patterns are overridable per project', () => {
  assert.equal(
    visualCoverageWarning({ changedFiles: ['a.css'], group: group('GREEN'), patterns: ['.styl'] }),
    null,
  )
  assert.ok(
    visualCoverageWarning({ changedFiles: ['a.styl'], group: group('GREEN'), patterns: ['.styl'] }),
  )
})

test('it warns rather than fails — the verdict is unaffected', () => {
  // A stylesheet touched for a lint fix has no visual consequence. Detection
  // should surface the omission, not tyrannise over it.
  const v = computeVerdict({ scores: { spec: 90, code: 90 }, floors, enabled: ['spec', 'code'] })
  assert.equal(v.status, 'PASS')
})

// ---- What a fix round actually has to re-run ----

const ENABLED = ['spec', 'runtime', 'code', 'visual', 'mutation']

test('the cheap global dimensions always re-run', () => {
  // runtime is the safety net: it is seconds, and it catches collateral damage
  // anywhere. spec and code are re-judged against the fix diff itself.
  const again = dimensionsToRecheck(['README.md'], { enabled: ENABLED })
  assert.ok(again.includes('runtime'))
  assert.ok(again.includes('spec'))
  assert.ok(again.includes('code'))
})

test('visual is skipped when the fix touched no view file', () => {
  // Nothing the browser would see has changed, so probing again cannot differ.
  const again = dimensionsToRecheck(['tests/countdown.test.mjs'], { enabled: ENABLED })
  assert.ok(!again.includes('visual'))
})

test('visual re-runs as soon as the fix touched one', () => {
  assert.ok(dimensionsToRecheck(['index.html'], { enabled: ENABLED }).includes('visual'))
  assert.ok(dimensionsToRecheck(['styles/a.css'], { enabled: ENABLED }).includes('visual'))
})

test('mutation re-runs only when the fix touched mutable source', () => {
  const opts = { enabled: ENABLED, mutateGlobs: ['scripts/lib/**/*.mjs'] }
  assert.ok(!dimensionsToRecheck(['README.md'], opts).includes('mutation'))
  assert.ok(dimensionsToRecheck(['scripts/lib/visual.mjs'], opts).includes('mutation'))
  // A changed test changes the score too — that is the whole point of mutation.
  assert.ok(dimensionsToRecheck(['tests/visual-parse.test.mjs'], opts).includes('mutation'))
})

test('a disabled dimension is never re-run', () => {
  const again = dimensionsToRecheck(['index.html'], { enabled: ['spec', 'runtime', 'code'] })
  assert.ok(!again.includes('visual'))
  assert.ok(!again.includes('mutation'))
})

test('an empty fix diff still re-runs the cheap dimensions', () => {
  // A fix that changed nothing is itself a finding; the run must not be skipped.
  const again = dimensionsToRecheck([], { enabled: ENABLED })
  assert.deepEqual(again.sort(), ['code', 'runtime', 'spec'])
})
