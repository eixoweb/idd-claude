import { test } from 'vitest'
import assert from 'node:assert/strict'
import { ALL_DIMENSIONS, readProject, readVerification } from '../scripts/lib/config.mjs'

test('runtime is enabled when the flag is absent', () => {
  assert.ok(readVerification('verification: {}').enabled.includes('runtime'))
})

test('runtime: false removes the dimension', () => {
  const { enabled } = readVerification('verification:\n  runtime: false\n')
  assert.ok(!enabled.includes('runtime'), 'an opted-out project must not be scored on runtime')
})

test('visual, mutation and acceptance follow their flags', () => {
  const { enabled } = readVerification(
    'verification:\n  visual: true\n  mutation: false\n  spec_as_source: false\n',
  )
  assert.ok(enabled.includes('visual'), 'visual: true must enable the dimension')
  assert.ok(!enabled.includes('mutation'), 'mutation: false must disable it')
  assert.ok(!enabled.includes('acceptance'), 'spec_as_source: false must disable acceptance')
})

test('spec_as_source is the single switch for the acceptance dimension', () => {
  assert.ok(readVerification('verification:\n  spec_as_source: true\n').enabled.includes('acceptance'))
})

test('only measured dimensions are switchable', () => {
  // spec and code are judged once in /idd:verify. A judgement has no switch, and
  // listing them here would invite a project to turn the judgement off.
  assert.deepEqual(ALL_DIMENSIONS, ['runtime', 'visual', 'mutation', 'acceptance'])
  assert.ok(!readVerification('verification: {}').enabled.includes('spec'))
  assert.ok(!readVerification('verification: {}').enabled.includes('code'))
})

test('mutation has a threshold, and it is the only one', () => {
  // runtime, visual and acceptance are pass/fail: their old floors were all 100,
  // which is a boolean wearing a number. Mutation is the one partial score that
  // means something.
  assert.equal(readVerification('verification: {}').mutationThreshold, 70)
  assert.equal(readVerification('verification:\n  mutation_threshold: 85\n').mutationThreshold, 85)
})

test('a threshold outside 0-100 is rejected loudly, with the value named', () => {
  assert.throws(() => readVerification('verification:\n  mutation_threshold: 140\n'), /140/)
  assert.throws(() => readVerification('verification:\n  mutation_threshold: "x"\n'), /mutation_threshold/)
})

test('execution shape is not a project setting', () => {
  // How the work runs — subagents, worktree — varies per change, and the tier
  // from the change schema already says it.
  const settings = readVerification('verification:\n  worktree: true\n  subagents: false\n')
  assert.equal(settings.worktree, undefined)
  assert.equal(settings.subagents, undefined)
})

test('the config carries only project facts and policy', () => {
  assert.deepEqual(Object.keys(readVerification('verification: {}')).sort(), [
    'enabled',
    'mutationThreshold',
  ])
})

test('the project facts are read in one place, not parsed again per caller', () => {
  const project = readProject(
    'project:\n  dev_stack_command: "pnpm dev"\n  dev_stack_url: "http://localhost:5173"\n  test_commands: ["pnpm test"]\n',
  )
  assert.equal(project.devStackCommand, 'pnpm dev')
  assert.equal(project.devStackUrl, 'http://localhost:5173')
  assert.deepEqual(project.testCommands, ['pnpm test'])
})

test('a missing project block reads as empty, not as a crash', () => {
  const project = readProject('verification: {}\n')
  assert.equal(project.devStackCommand, null)
  assert.equal(project.devStackUrl, null)
  assert.deepEqual(project.testCommands, [])
})
