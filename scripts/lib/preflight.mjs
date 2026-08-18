import { parse } from 'yaml'
import { readVerification } from './config.mjs'

// The tier is not a judgement: the schema the change was created with says it.
const TIERS = { 'idd-claude-lite': 'bounded', 'idd-claude': 'architectural' }

// Bounded work is one person doing one thing: no parallelism to protect, so no
// worktree and no per-task subagents. Architectural work may want both.
const SHAPE = {
  bounded: { worktree: false, subagents: false },
  architectural: { worktree: true, subagents: true },
}

/**
 * Everything /idd:apply must know before it starts, decided here rather than
 * evaluated as prose in the prompt. Five conditional branches an agent reads
 * and interprets — each free to check a prerequisite the expensive way — become
 * one command with one answer.
 */
export function preflight({ config, schema, tools }) {
  const { enabled } = readVerification(config)
  const parsed = parse(String(config)) ?? {}
  const project = parsed.project ?? {}

  const refusals = []
  const notes = []

  const tier = TIERS[schema]
  if (!tier) {
    refusals.push(
      `the change was created with schema "${schema}", which is not one of this workflow's — recreate it with --schema idd-claude or idd-claude-lite`,
    )
  }

  if (enabled.includes('visual')) {
    if (!tools.devBrowser) refusals.push('visual is on but dev-browser is not on PATH')
    if (!project.dev_stack_command) refusals.push('visual is on but project.dev_stack_command is empty')
  }

  if (enabled.includes('runtime')) {
    if (!project.test_commands?.length) {
      refusals.push(
        'runtime is on but project.test_commands is empty — configure them, or set runtime: false to record that this project has no test suite',
      )
    }
  } else {
    notes.push('runtime is off: nothing executable gates this change')
  }

  if (enabled.includes('mutation') && !tools.stryker) {
    refusals.push('mutation is on but there is no stryker.config.json')
  }

  if (enabled.includes('acceptance')) {
    if (!tools.acceptanceDir) refusals.push('spec_as_source is on but acceptance-tests/ is missing')
    if (!tools.cucumber) refusals.push('spec_as_source is on but cucumber-js is not installed')
  }

  return {
    ok: refusals.length === 0,
    refusals,
    notes,
    enabled,
    tier: tier ?? null,
    ...(tier ? SHAPE[tier] : { worktree: null, subagents: null }),
  }
}
