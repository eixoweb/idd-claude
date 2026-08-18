import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const apply = readFileSync(new URL('commands/apply.md', root), 'utf8')
const applyFlat = apply.replace(/\s+/g, ' ')

test('apply mandates the TDD skill at session start', () => {
  assert.match(apply, /superpowers:test-driven-development/)
  assert.match(applyFlat, /no GREEN without a preceding RED/)
})

test('apply implements and does not judge its own work', () => {
  // The evaluator gate cost as much as the implementation it guarded: 8.3
  // minutes against 8.7 on a 4,890-byte diff. Judgement moved to /idd:verify,
  // once, at the end.
  assert.match(applyFlat, /Apply implements\. It does not judge its own work/)
  assert.match(applyFlat, /the gate is `\/idd:verify`/)
  assert.doesNotMatch(apply, /evaluator|RETRY|BLOCK\b/)
})

test('apply delegates its preflight to a script, not to prose', () => {
  assert.match(apply, /preflight-cli\.mjs/)
  assert.match(applyFlat, /report its `refusals` verbatim and \*\*stop\*\*/)
})

test('apply takes the shape as decided, instead of re-deriving it', () => {
  assert.match(applyFlat, /do not re-derive it/i)
  assert.match(applyFlat, /only.{0,40}`worktree` is true/i)
  assert.match(apply, /single docroot|DDEV/)
})

test('apply wires the multi-agent layer', () => {
  assert.match(apply, /superpowers:using-git-worktrees/)
  assert.match(apply, /superpowers:subagent-driven-development/)
})

test('apply documents the degraded fallback and its loss', () => {
  assert.match(apply, /superpowers:executing-plans/)
  assert.match(apply, /does not transitively activate/i)
})

test('apply gets the dev stack from the preflight rather than probing for it', () => {
  assert.match(apply, /devStack/)
  assert.match(applyFlat, /listening/i)
  assert.doesNotMatch(applyFlat, /lsof/)
})

test('the visual assertions of a group go in one call, not one per task', () => {
  // Four tool round trips for four tasks. Measured, the browser was never the
  // cost: 2990ms sequential against 2224ms batched.
  assert.match(applyFlat, /in \*\*one\*\* call, never one call per task/)
})

test('the automatic REFACTOR rule is enforced by a script before the handoff', () => {
  // 148 seconds of evaluator time for a verdict a 37ms script returns.
  assert.match(apply, /refactor-guard-cli\.mjs/)
  assert.match(applyFlat, /no judgement is involved and none is asked for/)
  assert.match(applyFlat, /Do not hand off until it is clean/)
})

test('apply does not pre-run the gate it is about to hand off to', () => {
  assert.match(applyFlat, /Do not pre-run its dimensions here/)
})

test('both schemas replaced the upstream apply instruction', () => {
  for (const dir of ['schema', 'schema-lite']) {
    const schema = parse(readFileSync(new URL(`${dir}/schema.yaml`, root), 'utf8'))
    assert.doesNotMatch(
      schema.apply.instruction,
      /work through pending tasks, mark complete as you go/,
      `${dir}: still carries the upstream apply instruction`,
    )
    assert.match(schema.apply.instruction, /idd:apply/, `${dir}: apply must point at the command`)
  }
})
