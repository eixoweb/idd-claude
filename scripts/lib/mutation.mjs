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

// Stryker has no --since: diff scoping is done by passing --mutate the files
// to mutate. Which files those are depends on what the diff touched.
const TEST_FILE = /(^|\/)tests?\/|\.(test|spec)\.[cm]?[jt]sx?$/

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  // ** crosses directories, * stops at one.
  const pattern = escaped.replace(/\*\*\//g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '(?:.*/)?')
  return new RegExp(`^${pattern}$`)
}

/**
 * - Any test file changed -> full run. Which modules a test covers is not
 *   derivable from its path, so scoping risks skipping the very module the
 *   change set out to strengthen. Measuring more slowly beats measuring the
 *   wrong thing cheaply — the same reasoning that makes an unevaluable
 *   dimension BLOCK rather than score zero.
 * - Only source files changed -> mutate exactly those.
 * - Neither -> nothing to measure.
 *
 * The cost is real: in a TDD project almost every diff touches tests, so
 * almost every run is full. Scoping earns its keep on refactors and on fix
 * tasks that touch no test.
 */
export function chooseMutationScope(changedFiles, mutateGlobs) {
  const matchers = mutateGlobs.map(globToRegExp)
  const files = (changedFiles ?? []).map(String)

  const touchesTests = files.some((file) => TEST_FILE.test(file))
  const mutate = files.filter((file) => matchers.some((re) => re.test(file)))

  if (touchesTests) return { mode: 'full', mutate: [] }
  if (mutate.length > 0) return { mode: 'scoped', mutate }

  return { mode: 'none', mutate: [] }
}
