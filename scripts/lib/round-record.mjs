// The verification artifact is the audit trail — the thing a reviewer reads in
// the PR instead of taking a PASS on trust. A run that produces rounds and
// records none of them has verified nothing anybody else can check, so writing
// it is a command, not an instruction the prompt hopes is followed.
const HEADING = '# Verification Report'

export function renderRound({
  group,
  attempt,
  status,
  scores,
  applicable,
  carried = [],
  findings = [],
  fixTasks = [],
}) {
  const measured = applicable.filter(
    (d) => !carried.includes(d) && scores[d] !== undefined && scores[d] !== null,
  )
  const lines = [`## Group ${group} — attempt ${attempt} — **${status}**`, '']

  lines.push('| Dimension | Score | Source |', '| --- | --- | --- |')
  for (const dimension of applicable) {
    const score = scores[dimension]
    // A dimension with no score was not measured — and on a BLOCK round none
    // of them were, because BLOCK stops before scoring.
    const source =
      score === undefined || score === null
        ? `not scored${status === 'BLOCK' ? ' — blocked before scoring' : ''}`
        : carried.includes(dimension)
          ? 'carried from the previous round'
          : 'measured'
    lines.push(`| \`${dimension}\` | ${score ?? '—'} | ${source} |`)
  }
  lines.push('')

  if (carried.length > 0) {
    lines.push(
      `Measured this round: ${measured.join(', ') || 'none'}. Carried: ${carried.join(', ')}.`,
      '',
    )
  }

  if (findings.length > 0) {
    lines.push('**Findings**', '')
    for (const finding of findings) lines.push(`- ${finding}`)
    lines.push('')
  }

  if (fixTasks.length > 0) {
    lines.push('**Fix tasks**', '')
    for (const task of fixTasks) lines.push(`- ${task}`)
    lines.push('')
  }

  return lines.join('\n')
}

export function appendRound(existing, round) {
  const body = renderRound(round)
  const current = String(existing ?? '').trim()
  if (!current) return `${HEADING}\n\n${body}`
  return `${current}\n\n${body}`
}
