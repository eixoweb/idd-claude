import { test } from 'vitest'
import assert from 'node:assert/strict'
import { evaluateVisual, buildProbeScript, parseVisualSpec } from '../scripts/lib/visual.mjs'

const style = (over = {}) => ({
  kind: 'style',
  selector: '.hero',
  property: 'font-size',
  expected: '68px',
  tolerance: null,
  ...over,
})

test('an exact match passes', () => {
  const result = evaluateVisual([style()], ['68px'])
  assert.equal(result.score, 100)
  assert.deepEqual(result.failures, [])
})

test('a numeric value inside the tolerance passes', () => {
  const result = evaluateVisual([style({ tolerance: 1 })], ['68.6px'])
  assert.equal(result.score, 100)
})

test('a numeric value outside the tolerance fails and reports both values', () => {
  const result = evaluateVisual([style({ tolerance: 1 })], ['64px'])
  assert.equal(result.score, 0)
  assert.equal(result.failures.length, 1)
  assert.match(result.failures[0].message, /expected 68px/)
  assert.match(result.failures[0].message, /got 64px/)
})

test('without a tolerance, a near miss still fails', () => {
  assert.equal(evaluateVisual([style()], ['68.5px']).score, 0)
})

test('non-numeric values compare as strings', () => {
  const flex = style({ property: 'display', expected: 'flex' })
  assert.equal(evaluateVisual([flex], ['flex']).score, 100)
  assert.equal(evaluateVisual([flex], ['block']).score, 0)
})

test('a count assertion compares numerically', () => {
  const count = { kind: 'count', selector: '.item', expected: 12 }
  assert.equal(evaluateVisual([count], [12]).score, 100)
  assert.equal(evaluateVisual([count], [11]).score, 0)
})

test('a missing element is a failure, not a crash', () => {
  const result = evaluateVisual([style()], [null])
  assert.equal(result.score, 0)
  assert.match(result.failures[0].message, /not found|no element/i)
})

test('the score is the proportion of assertions that hold', () => {
  const assertions = [style(), { kind: 'count', selector: '.item', expected: 2 }]
  assert.equal(evaluateVisual(assertions, ['68px', 2]).score, 100)
  assert.equal(evaluateVisual(assertions, ['68px', 5]).score, 50)
  assert.equal(evaluateVisual(assertions, ['12px', 5]).score, 0)
})

test('the probe script targets the declared url and viewport', () => {
  const spec = parseVisualSpec(['url: /contact', 'viewport: 768', 'count .x  1'])
  const script = buildProbeScript(spec, 'https://example.test')
  assert.match(script, /https:\/\/example\.test\/contact/)
  assert.match(script, /768/)
  assert.match(script, /getComputedStyle|querySelectorAll/)
})

// ---- Failure messages and probe construction (group 2) ----

test('a style failure names the property, the expected and the measured value', () => {
  const { failures } = evaluateVisual([style({ property: 'padding-block' })], ['12px'])
  assert.equal(failures[0].property, 'padding-block')
  assert.equal(failures[0].selector, '.hero')
  assert.match(failures[0].message, /\.hero padding-block/)
  assert.match(failures[0].message, /expected 68px/)
  assert.match(failures[0].message, /got 12px/)
})

test('a count failure is labelled count, not by a property', () => {
  const { failures } = evaluateVisual([{ kind: 'count', selector: '.item', expected: 3 }], [5])
  assert.equal(failures[0].property, 'count')
  assert.match(failures[0].message, /\.item count/)
  assert.match(failures[0].message, /expected 3/)
  assert.match(failures[0].message, /got 5/)
})

test('a missing element names the selector it looked for', () => {
  const { failures } = evaluateVisual([style({ selector: '.absent' })], [null])
  assert.match(failures[0].message, /\.absent/)
  assert.match(failures[0].message, /no element matched/)
})

test('values with different units never compare as numbers', () => {
  // 68px and 68% share a magnitude and mean nothing alike.
  assert.equal(evaluateVisual([style({ expected: '68px' })], ['68%']).score, 0)
  assert.equal(evaluateVisual([style({ expected: '68px', tolerance: 5 })], ['68%']).score, 0)
})

test('a unitless number still compares numerically', () => {
  assert.equal(evaluateVisual([style({ expected: '700' })], ['700']).score, 100)
  assert.equal(evaluateVisual([style({ expected: '700', tolerance: 0 })], ['400']).score, 0)
})

test('negative and fractional values are read as numbers', () => {
  assert.equal(evaluateVisual([style({ expected: '-2px', tolerance: 0.5 })], ['-2.4px']).score, 100)
  assert.equal(evaluateVisual([style({ expected: '-2px', tolerance: 0.1 })], ['-2.4px']).score, 0)
})

test('the tolerance is inclusive at its boundary', () => {
  assert.equal(evaluateVisual([style({ tolerance: 1 })], ['69px']).score, 100)
  assert.equal(evaluateVisual([style({ tolerance: 1 })], ['69.01px']).score, 0)
})

test('each assertion kind produces its own probe, in the declared order', () => {
  const spec = parseVisualSpec([
    'url: /',
    'count  .first   2',
    'assert .second  color  red',
  ])
  const script = buildProbeScript(spec, 'https://example.test')
  const probes = JSON.parse(script.match(/const probes = (\[.*?\]);/s)[1])

  assert.deepEqual(probes, [
    { kind: 'count', selector: '.first' },
    { kind: 'style', selector: '.second', property: 'color' },
  ])
})

test('a count probe carries no property and a style probe does', () => {
  const spec = parseVisualSpec(['url: /', 'count .a  1'])
  const [probe] = JSON.parse(buildProbeScript(spec, 'https://x.test').match(/const probes = (\[.*?\]);/s)[1])
  assert.equal(probe.property, undefined, 'a count has no property to read')
})

test('the probe resolves the url against the base rather than concatenating', () => {
  const spec = parseVisualSpec(['url: /deep/page', 'count .a  1'])
  const script = buildProbeScript(spec, 'https://example.test/ignored')
  assert.match(script, /"https:\/\/example\.test\/deep\/page"/)
})
