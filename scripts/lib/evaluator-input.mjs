// The change's own artifacts are not code under review. Carrying their diff
// inflates the payload and dilutes the review — an evaluator has no business
// re-reading the proposal it is measuring against.
const PAPERWORK = /^openspec\//

export function splitDiffFiles(files) {
  const all = (files ?? []).map(String)
  return {
    code: all.filter((f) => !PAPERWORK.test(f)),
    artifacts: all.filter((f) => PAPERWORK.test(f)),
  }
}

// Ready to pass straight to visual-cli.mjs, one array per task, so the
// evaluator never has to parse tasks.md to find them.
export function visualAssertionsFor(group) {
  return (group?.tasks ?? [])
    .filter((task) => task.type === 'VISUAL')
    .map((task) => ({ ordinal: task.ordinal, lines: task.lines }))
}

export function selectGroups(groups, tier, groupNumber) {
  if (tier === 'bounded') return groups

  if (groupNumber === null || groupNumber === undefined) {
    throw new Error('an architectural change is evaluated per group: pass a group number')
  }
  const found = groups.find((g) => g.number === Number(groupNumber))
  if (!found) throw new Error(`there is no group ${groupNumber} in tasks.md`)
  return [found]
}
