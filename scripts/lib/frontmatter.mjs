import { parse } from 'yaml'

const DELIMITED = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

export function parseFrontmatter(source) {
  const match = String(source).match(DELIMITED)
  if (!match) return null
  const parsed = parse(match[1])
  return parsed && typeof parsed === 'object' ? parsed : null
}
