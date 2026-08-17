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
