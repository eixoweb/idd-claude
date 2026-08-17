import { parse } from 'yaml'

export const ALL_DIMENSIONS = ['spec', 'runtime', 'code', 'visual', 'mutation', 'acceptance']

// spec and code need no infrastructure — the evaluator scores them from the
// diff and the review — so there is no legitimate reason to switch them off.
const ALWAYS_ON = ['spec', 'code']

const DEFAULT_FLOORS = {
  spec: 80,
  runtime: 100,
  code: 60,
  visual: 100,
  mutation: 70,
  acceptance: 100,
}

export function readVerification(configSource) {
  const config = parse(String(configSource)) ?? {}
  const v = config.verification ?? {}

  const floors = { ...DEFAULT_FLOORS }
  for (const [dimension, value] of Object.entries(v.floors ?? {})) {
    if (!ALL_DIMENSIONS.includes(dimension)) {
      throw new Error(`unknown dimension "${dimension}" in verification.floors`)
    }
    if (typeof value !== 'number' || value < 0 || value > 100) {
      throw new Error(`floor for "${dimension}" must be a number between 0 and 100, got ${value}`)
    }
    floors[dimension] = value
  }

  const enabled = [...ALWAYS_ON]
  // Defaults to on: a project without tests must say so out loud.
  if (v.runtime !== false) enabled.push('runtime')
  if (v.visual) enabled.push('visual')
  if (v.mutation) enabled.push('mutation')
  if (v.spec_as_source) enabled.push('acceptance')

  return {
    enabled,
    floors,
    maxIterations: v.max_iterations ?? 5,
    evaluatorModel: v.evaluator_model ?? 'sonnet',
    subagents: v.subagents ?? true,
  }
}
