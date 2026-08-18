import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const apply = readFileSync(new URL('commands/apply.md', root), 'utf8')

test('apply mandates the TDD skill at session start', () => {
  assert.match(apply, /superpowers:test-driven-development/)
})

test('apply derives the run shape from the tier, not from config', () => {
  assert.doesNotMatch(apply, /verification\.worktree|verification\.subagents/)
  assert.match(apply, /bounded/i)
  assert.match(apply, /architectural/i)
  assert.match(apply, /work in place/i)
  // The trap that makes an enabled worktree wrong: the visual gate would
  // probe the main checkout while the edits are in the worktree.
  assert.match(apply, /single docroot|DDEV/)
})

test('apply wires the multi-agent layer', () => {
  assert.match(apply, /superpowers:using-git-worktrees/)
  assert.match(apply, /superpowers:subagent-driven-development/)
  assert.match(apply, /superpowers:verification-before-completion/)
})

const applyFlat = apply.replace(/\s+/g, ' ')

test('a bounded change is evaluated once, not once per group', () => {
  // The gate has to cost less than the change is worth, or it stops being used.
  assert.match(applyFlat, /once, after the last group/)
  assert.match(applyFlat, /not a reason to pay for the gate twice/)
})

test('an independent group does not wait on the previous verdict', () => {
  assert.match(applyFlat, /do not idle while the verdict comes back/i)
  assert.match(applyFlat, /Only serialise when the groups genuinely depend/)
})

test('gathering the inputs is one scripted call, not hand-built git commands', () => {
  // Two git diffs the agent composed itself, one redundant with the other, and
  // a base ref it guessed. 282ms of script replaced it.
  assert.match(apply, /evaluator-input-cli\.mjs/)
  assert.match(applyFlat, /excludes the change's own artifacts/)
})

test('apply hands the evaluator its inputs rather than sending it looking', () => {
  // The evaluator's charter says it receives only the contract, specs and
  // diff. The dispatch has to make that true; asserting it is not enough — and
  // an evaluator that fetches its own inputs spends most of its turns on it.
  assert.match(applyFlat, /Gather its inputs with one command, and pass them in the dispatch/)
  assert.match(applyFlat, /a charter the dispatch has to make true, not merely assert/)
  assert.match(apply, /verification\.evaluator_model/)
})

test('apply forbids calling the code review directly', () => {
  assert.match(apply, /NEVER invoke `superpowers:requesting-code-review` directly/)
})

test('apply documents the degraded fallback and its loss', () => {
  assert.match(apply, /superpowers:executing-plans/)
  assert.match(apply, /does not transitively activate/i)
})

test('apply delegates its preflight to a script, not to prose', () => {
  // Five conditional branches an agent reads and interprets — each free to
  // check a prerequisite the expensive way — became one command with one
  // answer. The prompt is read on every run; a script is not reasoned over.
  assert.match(apply, /preflight-cli\.mjs/)
  assert.match(applyFlat, /report its `refusals` verbatim and \*\*stop\*\*/)
  assert.match(applyFlat, /stops the run rather than quietly disappearing/)
})

test('apply derives the run shape from the preflight, not from config keys', () => {
  assert.match(applyFlat, /returns `tier`, `subagents` and `worktree`/)
  assert.doesNotMatch(apply, /verification\.worktree|verification\.subagents/)
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

test('a fix round is incremental, not a fresh evaluation', () => {
  assert.match(applyFlat, /A fix round is not a fresh evaluation/)
  assert.match(applyFlat, /the \*\*fix diff\*\*, not the whole group diff/)
  assert.match(applyFlat, /carried, not re-measured/)
  // runtime is what makes the skips safe rather than optimistic.
  assert.match(applyFlat, /always re-runs.*catches damage anywhere/)
})
