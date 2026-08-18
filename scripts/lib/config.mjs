import { parse } from 'yaml'

// The dimensions a script measures. `spec` and `code` are not here on purpose:
// they are judged, once, in /idd:verify, and a judgement has no switch — see
// docs/dimensions.md.
export const ALL_DIMENSIONS = ['runtime', 'visual', 'mutation', 'acceptance']

const DEFAULT_MUTATION_THRESHOLD = 70

export function readVerification(configSource) {
  const config = parse(String(configSource)) ?? {}
  const v = config.verification ?? {}

  const enabled = []
  // Defaults to on: a project without tests must say so out loud.
  if (v.runtime !== false) enabled.push('runtime')
  if (v.visual) enabled.push('visual')
  if (v.mutation) enabled.push('mutation')
  if (v.spec_as_source) enabled.push('acceptance')

  const threshold = v.mutation_threshold ?? DEFAULT_MUTATION_THRESHOLD
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
    throw new Error(`verification.mutation_threshold must be 0-100, got ${threshold}`)
  }

  // One threshold, not a table of floors. runtime, visual and acceptance are
  // pass/fail — a floor of 100 is a boolean wearing a number — and mutation is
  // the only dimension where a partial score means anything.
  return { enabled, mutationThreshold: threshold }
}

/**
 * The project's facts, read once. Several callers need the dev stack URL; two
 * readers of the same key is how they drift apart.
 */
export function readProject(configSource) {
  const project = (parse(String(configSource)) ?? {}).project ?? {}
  return {
    devStackCommand: project.dev_stack_command || null,
    devStackUrl: project.dev_stack_url || null,
    testCommands: project.test_commands ?? [],
  }
}
