export const UNKNOWN = 'UNKNOWN'

export function computeVerdict({ scores, floors, enabled }) {
  const unevaluated = []
  const failed = []

  for (const dimension of enabled) {
    const score = scores[dimension]
    if (score === undefined || score === null || score === UNKNOWN) {
      unevaluated.push(dimension)
      continue
    }
    if (score < floors[dimension]) failed.push(dimension)
  }

  // A dimension that could not be evaluated is an infrastructure problem, not
  // a code defect — retrying the implementation would never clear it.
  if (unevaluated.length > 0) return { status: 'BLOCK', failed, unevaluated }
  if (failed.length > 0) return { status: 'RETRY', failed, unevaluated }
  return { status: 'PASS', failed, unevaluated }
}

// A dimension can be enabled for the project yet have nothing to measure in a
// given group. `visual` is the case that matters: its assertions are declared
// in VISUAL tasks, so a group without one has no visual claim to check.
//
// Applicability is derived from the tasks artifact rather than reported by the
// evaluator on purpose. A sentinel the model could emit — "N/A" — would just
// move the free pass: saying it would be enough to escape the gate. Reading
// tasks.md is not something a model can talk its way around.
const TASK_DERIVED = { visual: 'VISUAL' }

export function applicableDimensions(enabled, group) {
  if (!group) return [...enabled]

  const present = new Set((group.tasks ?? []).map((task) => task.type))
  return enabled.filter((dimension) => {
    const required = TASK_DERIVED[dimension]
    return required === undefined || present.has(required)
  })
}

// Applicability tells us a group without a VISUAL task has no visual claim to
// check. It cannot tell us whether it *should* have had one. This closes that
// half: if the group changed a template or a stylesheet and declared no visual
// assertion, say so.
//
// It warns rather than fails on purpose. A stylesheet touched for a lint fix
// has no visual consequence, and a gate that cannot tell the difference would
// be dodged by whoever it inconveniences. Detection, then a human decides.
export const VIEW_PATTERNS = [
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
  '.vue', '.svelte', '.jsx', '.tsx', '.twig', '.erb', '.blade.php',
]

export function visualCoverageWarning({ changedFiles, group, patterns = VIEW_PATTERNS }) {
  const declaresVisual = (group?.tasks ?? []).some((task) => task.type === 'VISUAL')
  if (declaresVisual) return null

  const viewFiles = (changedFiles ?? []).filter((file) =>
    patterns.some((pattern) => String(file).toLowerCase().endsWith(pattern)),
  )
  if (viewFiles.length === 0) return null

  return `group ${group?.number ?? '?'} changed ${viewFiles.join(', ')} but declares no VISUAL task — the visual gate did not run on this group`
}
