import { test } from 'vitest'
import assert from 'node:assert/strict'
import { preflight } from '../scripts/lib/preflight.mjs'

const base = {
  config:
    'verification:\n  visual: true\nproject:\n  dev_stack_command: "x"\n  dev_stack_url: "http://localhost:3000"\n  test_commands: ["npm test"]\n',
  schema: 'idd-claude-lite',
  tools: { devBrowser: true, stryker: true, cucumber: true, acceptanceDir: true, devStackListening: false },
}

test('a satisfied project passes with nothing to refuse', () => {
  const r = preflight(base)
  assert.equal(r.ok, true)
  assert.deepEqual(r.refusals, [])
})

test('the tier comes from the schema the change was created with', () => {
  assert.equal(preflight(base).tier, 'bounded')
  assert.equal(preflight({ ...base, schema: 'idd-claude' }).tier, 'architectural')
})

test('a bounded change runs in place without subagents', () => {
  const r = preflight(base)
  assert.equal(r.worktree, false)
  assert.equal(r.subagents, false)
})

test('an architectural change may use both', () => {
  const r = preflight({ ...base, schema: 'idd-claude' })
  assert.equal(r.worktree, true)
  assert.equal(r.subagents, true)
})

test('visual without dev-browser refuses, and names what is missing', () => {
  const r = preflight({ ...base, tools: { ...base.tools, devBrowser: false } })
  assert.equal(r.ok, false)
  assert.match(r.refusals[0], /dev-browser/)
})

test('visual without a dev stack command refuses', () => {
  const r = preflight({ ...base, config: 'verification:\n  visual: true\nproject:\n  test_commands: ["t"]\n' })
  assert.equal(r.ok, false)
  assert.match(r.refusals[0], /dev_stack_command/)
})

test('runtime without test commands refuses rather than blocking every group', () => {
  const r = preflight({ ...base, config: 'verification: {}\nproject: {}\n' })
  assert.equal(r.ok, false)
  assert.match(r.refusals.join(' '), /test_commands/)
})

test('runtime turned off is reported, not refused', () => {
  const r = preflight({ ...base, config: 'verification:\n  runtime: false\n  visual: false\nproject: {}\n' })
  assert.equal(r.ok, true)
  assert.match(r.notes.join(' '), /runtime is off/i)
})

test('a disabled dimension is never checked', () => {
  // mutation off means a missing stryker config is not a problem.
  const r = preflight({
    config: 'verification:\n  visual: false\nproject:\n  test_commands: ["t"]\n',
    schema: 'idd-claude-lite',
    tools: { devBrowser: false, stryker: false, cucumber: false, acceptanceDir: false },
  })
  assert.equal(r.ok, true)
})

test('every unmet prerequisite is listed, not just the first', () => {
  const r = preflight({
    config: 'verification:\n  visual: true\n  mutation: true\nproject: {}\n',
    schema: 'idd-claude-lite',
    tools: { devBrowser: false, stryker: false, cucumber: false, acceptanceDir: false },
  })
  assert.ok(r.refusals.length >= 3, `expected several refusals, got ${r.refusals.length}`)
})

test('an unknown schema is a refusal rather than a guessed tier', () => {
  const r = preflight({ ...base, schema: 'spec-driven' })
  assert.equal(r.ok, false)
  assert.match(r.refusals.join(' '), /spec-driven/)
})

test('visual without a dev stack url refuses rather than letting the URL be guessed', () => {
  // The evaluator's charter promises it is given the dev stack URL. Nothing
  // produced one, so every run invented it from the command string — the exact
  // class of guess the preflight exists to remove.
  const r = preflight({
    ...base,
    config: 'verification:\n  visual: true\nproject:\n  dev_stack_command: "x"\n  test_commands: ["t"]\n',
  })
  assert.equal(r.ok, false)
  assert.match(r.refusals.join(' '), /dev_stack_url/)
})

test('the preflight hands back the dev stack, so no one has to reconstruct it', () => {
  const r = preflight(base)
  assert.equal(r.devStack.command, 'x')
  assert.equal(r.devStack.url, 'http://localhost:3000')
})

test('the preflight says whether the stack is already up, so a run does not probe it again', () => {
  assert.equal(preflight(base).devStack.listening, false)
  assert.equal(
    preflight({ ...base, tools: { ...base.tools, devStackListening: true } }).devStack.listening,
    true,
  )
})

test('visual off means there is no dev stack to report', () => {
  const r = preflight({
    ...base,
    config: 'verification:\n  visual: false\nproject:\n  test_commands: ["t"]\n',
  })
  assert.equal(r.ok, true)
  assert.equal(r.devStack, null)
})

test('a bounded change is evaluated by a cheaper model than an architectural one', () => {
  // The gate has to cost less than the unit of work it guards: 8.3 minutes of
  // evaluator against 8.7 of implementation is the failure this design names.
  assert.equal(preflight(base).evaluatorModel, 'haiku')
  assert.equal(preflight({ ...base, schema: 'idd-claude' }).evaluatorModel, 'sonnet')
})

test('a configured evaluator model beats the tier default', () => {
  const r = preflight({
    ...base,
    config:
      'verification:\n  visual: true\n  evaluator_model: opus\nproject:\n  dev_stack_command: "x"\n  dev_stack_url: "http://l:1"\n  test_commands: ["t"]\n',
  })
  assert.equal(r.evaluatorModel, 'opus')
})
