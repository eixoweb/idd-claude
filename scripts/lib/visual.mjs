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

const NUMERIC = /^(-?\d+(?:\.\d+)?)([a-z%]*)$/i

function holds(assertion, actual) {
  if (actual === null || actual === undefined) {
    return { ok: false, reason: `no element matched "${assertion.selector}"` }
  }

  if (assertion.kind === 'count') {
    const ok = Number(actual) === assertion.expected
    return { ok, reason: ok ? null : `expected ${assertion.expected}, got ${actual}` }
  }

  const expected = String(assertion.expected).match(NUMERIC)
  const measured = String(actual).match(NUMERIC)

  if (expected && measured && expected[2] === measured[2]) {
    const tolerance = assertion.tolerance ?? 0
    const ok = Math.abs(Number(measured[1]) - Number(expected[1])) <= tolerance
    return { ok, reason: ok ? null : `expected ${assertion.expected}, got ${actual}` }
  }

  const ok = String(actual) === String(assertion.expected)
  return { ok, reason: ok ? null : `expected ${assertion.expected}, got ${actual}` }
}

export function evaluateVisual(assertions, measured) {
  const failures = []

  assertions.forEach((assertion, index) => {
    const { ok, reason } = holds(assertion, measured[index])
    if (!ok) {
      const property = assertion.property ?? 'count'
      failures.push({
        selector: assertion.selector,
        property,
        message: `${assertion.selector} ${property}: ${reason}`,
      })
    }
  })

  const passed = assertions.length - failures.length
  return { score: Math.round((100 * passed) / assertions.length), failures }
}

export function buildProbeScript(spec, baseUrl) {
  const target = new URL(spec.url, baseUrl).toString()
  const probes = spec.assertions.map((a) =>
    a.kind === 'count'
      ? { kind: 'count', selector: a.selector }
      : { kind: 'style', selector: a.selector, property: a.property },
  )

  return `const page = await browser.getPage("idd-visual");
await page.setViewportSize({ width: ${spec.viewport}, height: 900 });
await page.goto(${JSON.stringify(target)}, { waitUntil: "networkidle" });
const probes = ${JSON.stringify(probes)};
const measured = await page.evaluate((probes) => probes.map((probe) => {
  if (probe.kind === "count") return document.querySelectorAll(probe.selector).length;
  const el = document.querySelector(probe.selector);
  if (!el) return null;
  return getComputedStyle(el).getPropertyValue(probe.property).trim();
}), probes);
console.log(JSON.stringify({ url: ${JSON.stringify(target)}, measured }));
`
}
