const URL_LINE = /^url:\s*(\S+)\s*$/
const VIEWPORT_LINE = /^viewport:\s*(\d+)\s*$/
const STYLE_LINE = /^assert\s+(.+?)\s{2,}(\S+)\s{2,}(\S+)(?:\s+±(\d+(?:\.\d+)?))?\s*$/
const COUNT_LINE = /^count\s+(.+?)\s{2,}(\d+)\s*$/

export const DEFAULT_VIEWPORT = 1440

export function parseVisualSpec(lines) {
  let url = null
  let viewport = DEFAULT_VIEWPORT
  const assertions = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const urlMatch = line.match(URL_LINE)
    if (urlMatch) {
      url = urlMatch[1]
      continue
    }

    const viewportMatch = line.match(VIEWPORT_LINE)
    if (viewportMatch) {
      viewport = Number(viewportMatch[1])
      continue
    }

    const styleMatch = line.match(STYLE_LINE)
    if (styleMatch) {
      const [, selector, property, expected, tolerance] = styleMatch
      assertions.push({
        kind: 'style',
        selector: selector.trim(),
        property,
        expected,
        tolerance: tolerance === undefined ? null : Number(tolerance),
      })
      continue
    }

    const countMatch = line.match(COUNT_LINE)
    if (countMatch) {
      assertions.push({
        kind: 'count',
        selector: countMatch[1].trim(),
        expected: Number(countMatch[2]),
      })
      continue
    }

    throw new Error(`unrecognised line in VISUAL task: "${line}"`)
  }

  if (!url) throw new Error('a VISUAL task must declare a url')
  if (assertions.length === 0) {
    throw new Error('a VISUAL task must declare at least one assertion')
  }

  return { url, viewport, assertions }
}
