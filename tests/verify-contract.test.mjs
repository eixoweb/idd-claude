import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const verify = readFileSync(new URL('../commands/verify.md', import.meta.url), 'utf8')
const flat = verify.replace(/\s+/g, ' ')

test('verify refuses to pass on unticked tasks', () => {
  assert.match(flat, /every checkbox must be ticked/i)
})

test('every mechanical dimension is measured by one command', () => {
  // Four scripts invoked one at a time is four tool round trips, each costing
  // more than the script it wraps.
  assert.match(verify, /verify-cli\.mjs/)
  assert.match(flat, /One command on purpose/)
})

test('verify does not re-run what the command already measured', () => {
  assert.match(flat, /the one check that cannot fail/)
})

test('verify judges what no script can settle', () => {
  assert.match(verify, /Completeness/)
  assert.match(verify, /Correctness/)
  assert.match(verify, /Coherence/)
})

test('the code review is independent, and this is where it is paid for', () => {
  // apply used to forbid it because the evaluator ran it internally — a subagent
  // paying for another subagent.
  assert.match(verify, /superpowers:requesting-code-review/)
  assert.match(flat, /an author is the worst judge/i)
})

test('work no requirement governs fails, and the fix is not the report to write', () => {
  assert.match(flat, /no SHALL covers/)
  assert.match(flat, /Do \*\*not\*\* write the missing requirement/)
  assert.match(flat, /one grows the spec, the other drops the code/)
})

test('an unmeasurable dimension blocks rather than passing quietly', () => {
  assert.match(flat, /never `FAIL`, and never a quiet `PASS`/)
})

test('verify writes one report and cannot soften it', () => {
  assert.match(verify, /superpowers:verification-before-completion/)
  assert.match(flat, /write \*\*one\*\* report to `verification\.md`/)
  assert.match(flat, /Never soften an outcome/)
  assert.match(flat, /PASS WITH WARNINGS/)
  assert.match(flat, /BLOCKED/)
})
