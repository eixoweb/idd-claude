import { test } from 'vitest'
import assert from 'node:assert/strict'
import { guardRefactor } from '../scripts/lib/refactor-guard.mjs'

const diff = (body) => body.trimStart()

const WEAKENED = diff(`
diff --git a/tests/countdown.test.mjs b/tests/countdown.test.mjs
--- a/tests/countdown.test.mjs
+++ b/tests/countdown.test.mjs
@@ -3,7 +3,7 @@
-  assert.equal(remainingLabel(65_000), "1:05")
+  assert.ok(remainingLabel(65_000).startsWith("1:"))
`)

const payload = (groups, diffText) => ({ groups, diff: diffText })

const refactorGroup = [
  { number: 2, title: 'Tidy', tasks: [{ ordinal: '2.3', type: 'REFACTOR', description: 'tidy' }] },
]

test('a REFACTOR group that drops an assertion is blocked before any dispatch', () => {
  // The run that motivated this spent 148s of evaluator time reaching the same
  // conclusion, on a rule the design already calls automatic.
  const r = guardRefactor(payload(refactorGroup, WEAKENED))
  assert.equal(r.blocked, true)
  assert.equal(r.findings.length, 1)
  assert.equal(r.findings[0].file, 'tests/countdown.test.mjs')
  assert.match(r.findings[0].removed, /assert\.equal\(remainingLabel/)
  assert.deepEqual(r.findings[0].refactorTasks, ['2.3'])
  assert.equal(r.findings[0].group, 2)
})

test('adding an assertion under REFACTOR is not weakening one', () => {
  const added = diff(`
diff --git a/tests/countdown.test.mjs b/tests/countdown.test.mjs
--- a/tests/countdown.test.mjs
+++ b/tests/countdown.test.mjs
@@ -3,6 +3,7 @@
+  assert.equal(remainingLabel(0), "0:00")
`)
  assert.equal(guardRefactor(payload(refactorGroup, added)).blocked, false)
})

test('a group with no REFACTOR task is not guarded', () => {
  // RED and GREEN churn tests by definition; only cleanup is suspect.
  const groups = [
    { number: 1, title: 'Build', tasks: [{ ordinal: '1.1', type: 'RED', description: 'x' }] },
  ]
  assert.equal(guardRefactor(payload(groups, WEAKENED)).blocked, false)
})

test('a removed line that asserts nothing is not a finding', () => {
  const noise = diff(`
diff --git a/tests/countdown.test.mjs b/tests/countdown.test.mjs
--- a/tests/countdown.test.mjs
+++ b/tests/countdown.test.mjs
@@ -1,4 +1,3 @@
-import { old } from './old.mjs'
-  // a stale comment
`)
  assert.equal(guardRefactor(payload(refactorGroup, noise)).blocked, false)
})

test('an assertion removed outside a test file is not a finding', () => {
  const src = diff(`
diff --git a/src/countdown.mjs b/src/countdown.mjs
--- a/src/countdown.mjs
+++ b/src/countdown.mjs
@@ -1,3 +1,2 @@
-  assert.equal(x, 1)
`)
  assert.equal(guardRefactor(payload(refactorGroup, src)).blocked, false)
})

test('the diff header itself is never mistaken for a removed line', () => {
  // `--- a/path` starts with a dash and would otherwise read as a deletion.
  const r = guardRefactor(payload(refactorGroup, WEAKENED))
  assert.ok(r.findings.every((f) => !f.removed.startsWith('-- ')))
})

test('several test files are all reported, not just the first', () => {
  const two = diff(`
diff --git a/tests/a.test.mjs b/tests/a.test.mjs
--- a/tests/a.test.mjs
+++ b/tests/a.test.mjs
@@ -1,2 +1,1 @@
-  expect(a).toBe(1)
diff --git a/tests/b.test.mjs b/tests/b.test.mjs
--- a/tests/b.test.mjs
+++ b/tests/b.test.mjs
@@ -1,2 +1,1 @@
-  assert.ok(b)
`)
  const r = guardRefactor(payload(refactorGroup, two))
  assert.equal(r.findings.length, 2)
  assert.deepEqual(r.findings.map((f) => f.file).sort(), ['tests/a.test.mjs', 'tests/b.test.mjs'])
})

test('an empty diff blocks nothing', () => {
  assert.equal(guardRefactor(payload(refactorGroup, '')).blocked, false)
})

test('an assertion restored in another quote style was never removed', () => {
  // REFACTOR is defined as cleanup at constant behaviour, so restyling a test is
  // squarely within it. Blocking on a requoted assertion would fire the guard on
  // routine cleanup, and a gate that cries wolf is a gate that gets bypassed.
  const reformatted = diff(`
diff --git a/tests/countdown.test.mjs b/tests/countdown.test.mjs
--- a/tests/countdown.test.mjs
+++ b/tests/countdown.test.mjs
@@ -3,7 +3,7 @@
-  assert.equal(remainingLabel(65_000), '1:05')
+  assert.equal(remainingLabel(65_000), "1:05")
`)
  assert.equal(guardRefactor(payload(refactorGroup, reformatted)).blocked, false)
})

test('the cancellation is exact: a replacement is not a restoration', () => {
  // assert.ok(...startsWith) is not the assert.equal it replaced, however
  // close the two lines look.
  assert.equal(guardRefactor(payload(refactorGroup, WEAKENED)).blocked, true)
})

test('a restoration in one file does not excuse a removal in another', () => {
  const mixed = diff(`
diff --git a/tests/a.test.mjs b/tests/a.test.mjs
--- a/tests/a.test.mjs
+++ b/tests/a.test.mjs
@@ -1,2 +1,2 @@
-  assert.equal(x, 1)
+  assert.equal(x, 1)
diff --git a/tests/b.test.mjs b/tests/b.test.mjs
--- a/tests/b.test.mjs
+++ b/tests/b.test.mjs
@@ -1,2 +1,1 @@
-  assert.equal(y, 2)
`)
  const r = guardRefactor(payload(refactorGroup, mixed))
  assert.equal(r.blocked, true)
  assert.deepEqual(r.findings.map((f) => f.file), ['tests/b.test.mjs'])
})

// ---- The two regexes are the whole guard: pin every branch ----

const removal = (file, line) =>
  diff(`
diff --git a/${file} b/${file}
--- a/${file}
+++ b/${file}
@@ -1,2 +1,1 @@
-${line}
`)

test('a test file is recognised by directory or by suffix, not by one convention', () => {
  const paths = [
    'test/a.js',
    'tests/a.js',
    'src/__tests__/a.js',
    'spec/a.rb',
    'a.test.js',
    'a.test.mjs',
    'a.test.cjs',
    'a.test.ts',
    'a.test.tsx',
    'a.spec.jsx',
    'deep/nested/b.spec.ts',
    'a_test.py',
  ]
  for (const p of paths) {
    const r = guardRefactor(payload(refactorGroup, removal(p, '  assert.equal(x, 1)')))
    assert.equal(r.blocked, true, `${p} should count as a test file`)
  }
})

test('a path that merely contains the word test is not a test file', () => {
  // `attestation.js` and `src/latest/a.js` are production code.
  for (const p of ['src/attestation.js', 'src/latest/a.js', 'contest.js']) {
    const r = guardRefactor(payload(refactorGroup, removal(p, '  assert.equal(x, 1)')))
    assert.equal(r.blocked, false, `${p} must not count as a test file`)
  }
})

test('each assertion vocabulary is recognised', () => {
  const lines = [
    'assert.equal(a, b)',
    'expect(a).toBe(b)',
    'a.should.equal(b)',
    'chai.assert(a)',
    't.is(a, b)',
    't.deepEqual(a, b)',
    't.truthy(a)',
    't.throws(fn)',
  ]
  for (const line of lines) {
    const r = guardRefactor(payload(refactorGroup, removal('tests/a.test.mjs', `  ${line}`)))
    assert.equal(r.blocked, true, `${line} should read as an assertion`)
  }
})

test('setup and teardown removed under cleanup are not assertions', () => {
  for (const line of ['  const x = 1', '  beforeEach(() => {})', '  await page.goto(url)']) {
    const r = guardRefactor(payload(refactorGroup, removal('tests/a.test.mjs', line)))
    assert.equal(r.blocked, false, `${line} must not read as an assertion`)
  }
})

test('the restoration match ignores spacing and quote style, and nothing else', () => {
  const requoted = diff(`
diff --git a/tests/a.test.mjs b/tests/a.test.mjs
--- a/tests/a.test.mjs
+++ b/tests/a.test.mjs
@@ -1,2 +1,2 @@
-  assert.equal(label(1),   'x')
+\tassert.equal(label(1), \`x\`)
`)
  assert.equal(guardRefactor(payload(refactorGroup, requoted)).blocked, false)

  const changedArgument = diff(`
diff --git a/tests/a.test.mjs b/tests/a.test.mjs
--- a/tests/a.test.mjs
+++ b/tests/a.test.mjs
@@ -1,2 +1,2 @@
-  assert.equal(label(1), 'x')
+  assert.equal(label(2), 'x')
`)
  assert.equal(guardRefactor(payload(refactorGroup, changedArgument)).blocked, true)
})

test('an added-file header is not read as an added assertion', () => {
  // `+++ b/path` starts with a plus; counting it as content would let a header
  // cancel a real removal.
  const r = guardRefactor(payload(refactorGroup, removal('tests/a.test.mjs', '  assert.ok(x)')))
  assert.equal(r.blocked, true)
  assert.equal(r.findings.length, 1)
})

test('with several cleanup groups the responsible one is not guessed', () => {
  const two = [
    { number: 1, title: 'a', tasks: [{ ordinal: '1.4', type: 'REFACTOR', description: '' }] },
    { number: 2, title: 'b', tasks: [{ ordinal: '2.3', type: 'REFACTOR', description: '' }] },
  ]
  const r = guardRefactor(payload(two, removal('tests/a.test.mjs', '  assert.ok(x)')))
  assert.equal(r.findings[0].group, null, 'ambiguous attribution must be stated, not picked')
  assert.deepEqual(r.findings[0].refactorTasks, ['1.4', '2.3'])
})

test('a group whose tasks are missing entirely does not crash the guard', () => {
  assert.equal(guardRefactor({ groups: [{ number: 1 }], diff: WEAKENED }).blocked, false)
  assert.equal(guardRefactor({}).blocked, false)
})
