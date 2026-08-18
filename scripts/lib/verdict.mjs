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
