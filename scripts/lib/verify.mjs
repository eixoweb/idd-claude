/**
 * The verdict over the mechanical dimensions — the ones a script measures and
 * no one judges. Kept out of the prompt on purpose: an agent that decides
 * whether its own run passed is the failure mode this whole workflow exists to
 * remove.
 */
export function scriptVerdict(dimensions) {
  const statuses = Object.values(dimensions ?? {}).map((d) => d?.status)

  // A real failure outranks a broken probe: it is the one someone can act on.
  if (statuses.includes('FAIL')) return 'FAIL'
  // Not measured is not green. A dev stack that would not start has verified
  // nothing, and a report that calls that PASS lies about what was checked.
  if (statuses.includes('UNKNOWN')) return 'BLOCKED'
  return 'PASS'
}
