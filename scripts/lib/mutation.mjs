// Stryker statuses that mean a test noticed the change.
const DETECTED = new Set(['Killed', 'Timeout'])
// Statuses that mean it did not — including NoCoverage, where no test runs the
// mutated line at all.
const UNDETECTED = new Set(['Survived', 'NoCoverage'])

export const UNKNOWN = 'UNKNOWN'

export function readMutationScore(report) {
  let detected = 0
  let scorable = 0

  for (const file of Object.values(report?.files ?? {})) {
    for (const mutant of file.mutants ?? []) {
      if (DETECTED.has(mutant.status)) {
        detected += 1
        scorable += 1
      } else if (UNDETECTED.has(mutant.status)) {
        scorable += 1
      }
      // CompileError, Ignored, RuntimeError: not the suite's fault, excluded.
    }
  }

  if (scorable === 0) return UNKNOWN
  return Math.round((100 * detected) / scorable)
}
