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

test('the code review is opt-in, and its absence is recorded rather than implied', () => {
  // It answers a different question from the gate's — is this code good, not
  // does it do what the spec asked — and it was the most expensive strand of a
  // run that happens on every change.
  assert.match(verify, /--review/)
  assert.match(flat, /\/idd:review/)
  assert.match(flat, /no independent review ran/i)
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

test('the three independent halves of verify do not wait on each other', () => {
  // The scripts, the code review and the spec-to-code reading share no input.
  // Run in sequence the wall clock is their sum; the review is a subagent and
  // the scripts can hold a browser and a mutation run.
  assert.match(flat, /in the background/i)
  assert.match(flat, /while it runs/i)
})

test('the outcome waits for every strand, so nothing is reported half-measured', () => {
  assert.match(flat, /before writing the outcome|only then/i)
})

test('the structural check is scoped to the change under verification', () => {
  // `--all` made one change's gate depend on every other change in the project:
  // a half-written proposal elsewhere would fail a change that is fine.
  assert.match(verify, /openspec validate <change id> --type change --strict/)
  assert.doesNotMatch(verify, /openspec validate --all/)
})

test('verify says where its three dimensions come from', () => {
  // They are OpenSpec's own, from /opsx:verify. A reader should know that, and
  // know why this reimplements rather than delegates.
  assert.match(flat, /opsx:verify/)
  assert.match(flat, /advisory|does not block/i)
})
