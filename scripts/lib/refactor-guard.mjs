// A path that holds tests. Deliberately conventional: a project that hides its
// tests somewhere unusual loses the guard, not the gate — the evaluator still
// applies the rule.
const TEST_PATH = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.[a-z]+$/i

// What makes a line an assertion rather than setup. Missing a framework here
// costs a guard, never a false BLOCK.
const ASSERTION = /\b(assert|expect|should|chai)\b|\bt\.(is|deepEqual|truthy|throws)\b/

const FILE_HEADER = /^\+\+\+ b\/(.+)$/

// Quote style and spacing are not assertions: a line that comes back reformatted
// was never removed. REFACTOR means "clean up at constant behaviour", so
// reformatting a test is the one thing the task is explicitly for — a guard that
// blocked on it would fire on almost every legitimate cleanup.
const normalise = (line) => line.replace(/\s+/g, '').replace(/['"`]/g, '"')

function removedTestAssertions(diff) {
  const removedByFile = new Map()
  const addedByFile = new Map()
  let file = null

  const record = (map, key, value) => {
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(value)
  }

  for (const line of String(diff ?? '').split('\n')) {
    const header = line.match(FILE_HEADER)
    if (header) {
      file = header[1]
      continue
    }
    // `--- a/path` and `+++ b/path` also start with those signs; they are
    // headers, not content.
    const removal = line.startsWith('-') && !line.startsWith('---')
    const addition = line.startsWith('+') && !line.startsWith('+++')
    if (!file || (!removal && !addition)) continue
    if (!TEST_PATH.test(file)) continue

    const content = line.slice(1).trim()
    if (!ASSERTION.test(content)) continue
    record(removal ? removedByFile : addedByFile, file, content)
  }

  const found = []
  for (const [file, removed] of removedByFile) {
    // Per file: a restoration elsewhere in the change excuses nothing.
    const restored = new Set((addedByFile.get(file) ?? []).map(normalise))
    for (const line of removed) {
      if (!restored.has(normalise(line))) found.push({ file, removed: line })
    }
  }

  return found
}

/**
 * The one rule the evaluator is told to apply automatically:
 *
 *   "A REFACTOR task whose diff touches a test assertion is automatically
 *    CRITICAL."
 *
 * Automatic, but it cost a full evaluator round to reach — 148 seconds on the
 * run that motivated this, for a verdict no judgement was involved in. Weakening
 * an assertion under cover of cleanup makes the suite agree with whatever the
 * code now does, and a diff shows it outright.
 *
 * Attribution is change-scoped, not task-scoped: a hunk cannot be tied back to
 * the task that wrote it without a commit per stage, which nothing guarantees.
 * The finding therefore names the cleanup tasks that could be responsible and
 * leaves the reading to whoever fixes it. Scoping wide loses precision; it never
 * loses safety, since the verdict is one the evaluator would have reached too.
 */
export function guardRefactor(payload) {
  const groups = payload?.groups ?? []
  const refactorGroups = groups.filter((g) =>
    (g.tasks ?? []).some((task) => task.type === 'REFACTOR'),
  )

  if (refactorGroups.length === 0) return { blocked: false, findings: [] }

  const refactorTasks = refactorGroups.flatMap((g) =>
    (g.tasks ?? []).filter((t) => t.type === 'REFACTOR').map((t) => t.ordinal),
  )
  // Ambiguous the moment more than one group cleans up: say so rather than pick.
  const group = refactorGroups.length === 1 ? refactorGroups[0].number : null

  const findings = removedTestAssertions(payload?.diff).map((f) => ({
    ...f,
    group,
    refactorTasks,
  }))

  return { blocked: findings.length > 0, findings }
}
