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

/**
 * What the dispatch carries instead of the payload itself: the path, plus
 * enough shape for the run to be readable without opening it. Re-emitting the
 * full payload into the Task prompt costs thousands of output tokens before the
 * evaluator has started, and the cost grows with the diff — exactly when the
 * evaluation matters most.
 */
export function dispatchCard(payload, payloadPath) {
  return {
    payload: payloadPath,
    changeId: payload.changeId,
    tier: payload.tier,
    base: payload.base,
    devStackUrl: payload.devStackUrl ?? null,
    groups: (payload.groups ?? []).map((g) => ({
      number: g.number,
      title: g.title,
      tasks: (g.tasks ?? []).length,
      visual: (g.visual ?? []).length,
    })),
    changedFiles: (payload.changedFiles ?? []).length,
    diffBytes: (payload.diff ?? '').length,
  }
}
