import { test } from 'node:test'
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
