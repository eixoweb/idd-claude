export const TASK_TYPES = ['RED', 'GREEN', 'REFACTOR', 'VISUAL', 'FIX', 'ACCEPT']

const GROUP = /^##\s+(\d+)\.\s+(.*)$/
const TASK = /^- \[([ xX])\]\s+(\S+)\s+(.*)$/
const CONTINUATION = /^\s{2,}\S/

export function parseTasks(source) {
  const groups = []
  let group = null
  let task = null

  for (const line of String(source).split(/\r?\n/)) {
    const groupMatch = line.match(GROUP)
    if (groupMatch) {
      group = { number: Number(groupMatch[1]), title: groupMatch[2].trim(), tasks: [] }
      groups.push(group)
      task = null
      continue
    }

    const taskMatch = line.match(TASK)
    if (taskMatch && group) {
      const [, checkbox, ordinal, rest] = taskMatch
      const keyword = rest.split(/\s+/)[0]
      const type = TASK_TYPES.includes(keyword) ? keyword : null
      const description = type
        ? rest.slice(keyword.length).replace(/^\s*—\s*|^\s+/, '').trim()
        : rest.trim()
      task = { ordinal, type, description, done: checkbox.toLowerCase() === 'x', lines: [] }
      group.tasks.push(task)
      continue
    }

    if (task && CONTINUATION.test(line)) task.lines.push(line.trim())
  }

  return groups
}
