import { test } from 'vitest'
import assert from 'node:assert/strict'
import { chooseMutationScope, readMutationScore, reporterPaths } from '../scripts/lib/mutation.mjs'

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

test('a source file with its own test still runs full', () => {
  // This assertion used to expect 'scoped', on the assumption that a changed
  // test belongs to the changed source. It does not always, and acting on the
  // assumption made the gate measure the wrong module. Paths cannot tell us
  // what a test covers, so a changed test means a full run.
  const scope = chooseMutationScope(['scripts/lib/verdict.mjs', 'tests/verdict.test.mjs'], GLOBS)
  assert.equal(scope.mode, 'full')
})

test('a source change plus test-only work on another module runs full', () => {
  // The case the paired test above does not cover: module A changed, and the
  // tests of an untouched module B changed too. Scoping to A would silently
  // skip B — the module the change may exist to measure. Measuring more
  // slowly beats measuring the wrong thing cheaply.
  const scope = chooseMutationScope(
    ['scripts/lib/mutation.mjs', 'tests/visual-parse.test.mjs'],
    GLOBS,
  )
  assert.equal(scope.mode, 'full')
})

test('a pure source diff still scopes', () => {
  const scope = chooseMutationScope(['scripts/lib/verdict.mjs'], GLOBS)
  assert.equal(scope.mode, 'scoped')
  assert.deepEqual(scope.mutate, ['scripts/lib/verdict.mjs'])
})

// ---- the reports have to exist before anyone can read them ----

test('the reporter paths fall back to Stryker own defaults', () => {
  // html is on by Stryker default and json is not — and json is the one the
  // score is read from, so a project with a perfectly valid config but no json
  // reporter used to get a silent UNKNOWN.
  const paths = reporterPaths('{}')
  assert.equal(paths.json, 'reports/mutation/mutation.json')
  assert.equal(paths.html, 'reports/mutation/mutation.html')
})

test('a project that moved its reports is followed, not overruled', () => {
  const paths = reporterPaths(
    JSON.stringify({
      jsonReporter: { fileName: 'out/m.json' },
      htmlReporter: { fileName: 'out/m.html' },
    }),
  )
  assert.equal(paths.json, 'out/m.json')
  assert.equal(paths.html, 'out/m.html')
})

test('an unreadable config falls back rather than throwing', () => {
  // The score is what matters; a broken config file is Stryker's to complain
  // about, not ours to crash on.
  assert.equal(reporterPaths('not json at all').json, 'reports/mutation/mutation.json')
  assert.equal(reporterPaths(null).html, 'reports/mutation/mutation.html')
})
