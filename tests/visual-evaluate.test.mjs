import { test } from 'node:test'
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
