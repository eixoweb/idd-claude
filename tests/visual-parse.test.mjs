import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseVisualSpec } from '../scripts/lib/visual.mjs'

const LINES = [
  'url: /',
  'viewport: 1440',
  'assert .hero__title  font-size      68px',
  'assert .hero         padding-block  224px ±1',
  'count  .hero .layout-section > *    12',
]

test('url and viewport are read from their own lines', () => {
  const spec = parseVisualSpec(LINES)
  assert.equal(spec.url, '/')
  assert.equal(spec.viewport, 1440)
})

test('viewport defaults to 1440 when absent', () => {
  assert.equal(parseVisualSpec(['url: /', 'count .x  1']).viewport, 1440)
})

test('a style assertion carries selector, property and expected value', () => {
  const [first] = parseVisualSpec(LINES).assertions
  assert.deepEqual(first, {
    kind: 'style',
    selector: '.hero__title',
    property: 'font-size',
    expected: '68px',
    tolerance: null,
  })
})

test('a tolerance is parsed off the end of the expected value', () => {
  const spec = parseVisualSpec(LINES)
  const padding = spec.assertions.find((a) => a.property === 'padding-block')
  assert.equal(padding.expected, '224px')
  assert.equal(padding.tolerance, 1)
})

test('a count assertion keeps a selector containing spaces', () => {
  const spec = parseVisualSpec(LINES)
  const count = spec.assertions.find((a) => a.kind === 'count')
  assert.equal(count.selector, '.hero .layout-section > *')
  assert.equal(count.expected, 12)
})

test('a VISUAL task with no url is a specification error', () => {
  assert.throws(() => parseVisualSpec(['viewport: 1440', 'count .x  1']), /url/)
})

test('a VISUAL task with no assertion is a specification error', () => {
  // An assertion-free visual task would pass silently — exactly the failure
  // mode this gate exists to prevent.
  assert.throws(() => parseVisualSpec(['url: /']), /at least one assertion/)
})

test('unknown directives are rejected rather than ignored', () => {
  assert.throws(() => parseVisualSpec(['url: /', 'looks nice']), /unrecognised line/)
})

// ---- What the parser rejects (group 1) ----

test('anchoring is enforced on every directive', () => {
  const trailing = [
    'url: / extra',
    'viewport: 1440 wide',
    'assert .a  font-size  10px trailing',
    'count  .a  3 trailing',
  ]
  for (const line of trailing) {
    assert.throws(
      () => parseVisualSpec(['url: /', line]),
      /unrecognised line/,
      `should reject trailing content: ${line}`,
    )
  }
})

test('a directive is not recognised mid-line', () => {
  assert.throws(() => parseVisualSpec(['url: /', 'x count  .a  1']), /unrecognised line/)
  assert.throws(() => parseVisualSpec(['url: /', 'please assert .a  b  1px']), /unrecognised line/)
})

test('the two-space separator is required', () => {
  assert.throws(() => parseVisualSpec(['url: /', 'assert .a font-size 10px']), /unrecognised line/)
  assert.throws(() => parseVisualSpec(['url: /', 'count .a 3']), /unrecognised line/)
})

test('a viewport must be numeric', () => {
  assert.throws(() => parseVisualSpec(['url: /', 'viewport: wide', 'count .a  1']), /unrecognised/)
  assert.throws(() => parseVisualSpec(['url: /', 'viewport: 14.4', 'count .a  1']), /unrecognised/)
})

test('a count must be a whole number', () => {
  assert.throws(() => parseVisualSpec(['url: /', 'count .a  two']), /unrecognised line/)
  assert.throws(() => parseVisualSpec(['url: /', 'count .a  1.5']), /unrecognised line/)
})

test('a url must carry a value', () => {
  assert.throws(() => parseVisualSpec(['url:', 'count .a  1']), /unrecognised line/)
})

test('surrounding blank lines and indentation are tolerated', () => {
  const spec = parseVisualSpec(['', '  url: /  ', '', '   count  .a  1  ', ''])
  assert.equal(spec.url, '/')
  assert.equal(spec.assertions.length, 1)
})
