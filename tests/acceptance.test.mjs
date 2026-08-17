import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readCucumberScore } from '../scripts/lib/acceptance.mjs'

const scenario = (...statuses) => ({ steps: statuses.map((status) => ({ result: { status } })) })
const report = (...scenarios) => [{ elements: scenarios }]

test('all scenarios passing scores 100', () => {
  assert.equal(readCucumberScore(report(scenario('passed', 'passed'), scenario('passed'))), 100)
})

test('a failing step fails its whole scenario', () => {
  assert.equal(readCucumberScore(report(scenario('passed', 'failed'), scenario('passed'))), 50)
})

test('an undefined step fails its scenario', () => {
  // An undefined step means a Given/When/Then with no step definition behind
  // it. The scenario proves nothing; counting it as passed would be a lie.
  assert.equal(readCucumberScore(report(scenario('passed', 'undefined'))), 0)
})

test('a pending step fails its scenario', () => {
  assert.equal(readCucumberScore(report(scenario('pending'))), 0)
})

test('a skipped step fails its scenario', () => {
  assert.equal(readCucumberScore(report(scenario('passed', 'skipped'))), 0)
})

test('scenarios are counted across every feature', () => {
  const twoFeatures = [
    { elements: [scenario('passed'), scenario('passed')] },
    { elements: [scenario('failed'), scenario('passed')] },
  ]
  assert.equal(readCucumberScore(twoFeatures), 75)
})

test('an empty report is UNKNOWN rather than 100', () => {
  // No scenario ran. Reporting 100 would hand out a free pass.
  assert.equal(readCucumberScore([]), 'UNKNOWN')
  assert.equal(readCucumberScore([{ elements: [] }]), 'UNKNOWN')
})

test('a scenario with no steps does not count as passed', () => {
  assert.equal(readCucumberScore(report({ steps: [] })), 'UNKNOWN')
})
