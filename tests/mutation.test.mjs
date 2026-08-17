import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readMutationScore } from '../scripts/lib/mutation.mjs'

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
