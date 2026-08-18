import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const apply = readFileSync(new URL('commands/apply.md', root), 'utf8')

test('apply mandates the TDD skill at session start', () => {
  assert.match(apply, /superpowers:test-driven-development/)
})

test('apply makes the worktree a choice, not the default path', () => {
  assert.match(apply, /verification\.worktree/)
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

test('apply forbids calling the code review directly', () => {
  assert.match(apply, /NEVER invoke `superpowers:requesting-code-review` directly/)
})

test('apply documents the degraded fallback and its loss', () => {
  assert.match(apply, /superpowers:executing-plans/)
  assert.match(apply, /does not transitively activate/i)
})

test('apply refuses to start rather than silently skipping a dimension', () => {
  assert.match(apply, /refuse to start/i)
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
