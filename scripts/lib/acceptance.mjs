export const UNKNOWN = 'UNKNOWN'

// Only `passed` proves anything. `undefined` means the step has no definition
// behind it, `pending` means it is a stub, `skipped` means it never ran —
// none of them demonstrate the behaviour.
const PASSED = 'passed'

function scenarioPassed(scenario) {
  const steps = scenario.steps ?? []
  if (steps.length === 0) return false
  return steps.every((step) => step.result?.status === PASSED)
}

export function readCucumberScore(report) {
  const scenarios = (report ?? []).flatMap((feature) => feature.elements ?? [])
  const runnable = scenarios.filter((s) => (s.steps ?? []).length > 0)

  if (runnable.length === 0) return UNKNOWN

  const passed = runnable.filter(scenarioPassed).length
  return Math.round((100 * passed) / runnable.length)
}
