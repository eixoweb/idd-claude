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

// The usual template and stylesheet extensions. Deliberately conventional: this
// only ever produces a warning, so a miss costs a warning, never a false fail.
const RENDERS = /\.(html?|css|scss|sass|less|vue|jsx|tsx|svelte|twig|erb|blade\.php|astro)$/i

/**
 * Applicability says a change with no VISUAL task makes no visual claim. It
 * cannot say whether it *should* have made one — which would leave the gate
 * exactly as strong as the diligence of whoever wrote tasks.md.
 *
 * So: if the change rendered something and declared no assertion about it, say
 * so. It **warns rather than fails**, deliberately — a stylesheet touched for a
 * lint fix has no visual consequence, and a gate that cannot tell the difference
 * gets routed around by whoever it inconveniences. Detection is deterministic;
 * the judgement stays human.
 */
export function visualCoverageWarning(groups, changedFiles) {
  const declared = (groups ?? []).some((g) => (g.tasks ?? []).some((t) => t.type === 'VISUAL'))
  if (declared) return null

  const rendered = (changedFiles ?? []).filter((f) => RENDERS.test(f))
  if (rendered.length === 0) return null

  return `changed ${rendered.join(', ')} but declares no VISUAL task — the visual gate did not run`
}
