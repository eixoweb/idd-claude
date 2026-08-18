import { test } from 'vitest'
import assert from 'node:assert/strict'
import { chooseMutationScope, readMutationScore } from '../scripts/lib/mutation.mjs'

const report = (statuses) => ({
  files: {
    'src/a.mjs': { mutants: statuses.map((status, id) => ({ id: String(id), status })) },
  },
})

test('every mutant killed scores 100', () => {
  assert.equal(readMutationScore(report(['Killed', 'Killed'])), 100)
})

test('a survivor lowers the score', () => {
  assert.equal(readMutationScore(report(['Killed', 'Survived'])), 50)
})

test('a timeout counts as killed', () => {
  // The mutant made the suite hang, which means a test did detect the change.
  assert.equal(readMutationScore(report(['Killed', 'Timeout'])), 100)
})

test('an uncovered mutant counts against the score', () => {
  // NoCoverage means no test even executes that code — the worst case, and the
  // one a coverage-blind score would hide.
  assert.equal(readMutationScore(report(['Killed', 'NoCoverage'])), 50)
})

test('compile errors and ignored mutants are excluded from the denominator', () => {
  assert.equal(readMutationScore(report(['Killed', 'CompileError', 'Ignored'])), 100)
})

test('a report with nothing scorable is UNKNOWN rather than 0 or 100', () => {
  // No scorable mutant means the run told us nothing. Reporting 100 would be a
  // free pass; reporting 0 would blame the implementation.
  assert.equal(readMutationScore(report(['CompileError'])), 'UNKNOWN')
  assert.equal(readMutationScore({ files: {} }), 'UNKNOWN')
})

test('mutants are counted across every file', () => {
  const multi = {
    files: {
      'a.mjs': { mutants: [{ status: 'Killed' }, { status: 'Killed' }] },
      'b.mjs': { mutants: [{ status: 'Survived' }, { status: 'Survived' }] },
    },
  }
  assert.equal(readMutationScore(multi), 50)
})

// ---- Choosing what to mutate for a given diff ----

const GLOBS = ['scripts/lib/**/*.mjs']

test('a diff touching source files mutates exactly those', () => {
  const scope = chooseMutationScope(['scripts/lib/visual.mjs', 'README.md'], GLOBS)
  assert.equal(scope.mode, 'scoped')
  assert.deepEqual(scope.mutate, ['scripts/lib/visual.mjs'])
})

test('a test-only diff falls back to a full run', () => {
  // Scoping to changed source files would leave nothing to mutate — exactly
  // when the mutation score is the deliverable.
  const scope = chooseMutationScope(['tests/visual-parse.test.mjs'], GLOBS)
  assert.equal(scope.mode, 'full')
})

test('a diff touching neither source nor tests has nothing to measure', () => {
  const scope = chooseMutationScope(['README.md', 'docs/workflow.md'], GLOBS)
  assert.equal(scope.mode, 'none')
})

test('a test file is recognised by name or by directory', () => {
  for (const file of ['tests/a.test.mjs', 'src/a.spec.js', 'tests/fixtures/b.mjs']) {
    assert.equal(chooseMutationScope([file], GLOBS).mode, 'full', `${file} should read as a test`)
  }
})

test('the double star crosses directories, the single star does not', () => {
  assert.equal(chooseMutationScope(['scripts/lib/deep/a.mjs'], GLOBS).mode, 'scoped')
  assert.equal(chooseMutationScope(['scripts/lib/a.mjs'], ['scripts/lib/*.mjs']).mode, 'scoped')
  assert.equal(chooseMutationScope(['scripts/lib/deep/a.mjs'], ['scripts/lib/*.mjs']).mode, 'none')
})

test('a source file and a test file together still scope to the source', () => {
  const scope = chooseMutationScope(['scripts/lib/verdict.mjs', 'tests/verdict.test.mjs'], GLOBS)
  assert.equal(scope.mode, 'scoped')
  assert.deepEqual(scope.mutate, ['scripts/lib/verdict.mjs'])
})
