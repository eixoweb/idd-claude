#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { parseVisualSpec, buildProbeScript, evaluateVisual } from './lib/visual.mjs'

const [linesJson, baseUrl] = process.argv.slice(2)
if (!linesJson || !baseUrl) {
  console.error('usage: visual-cli.mjs <assertionLinesJson> <baseUrl>')
  process.exit(2)
}

const spec = parseVisualSpec(JSON.parse(linesJson))
const script = buildProbeScript(spec, baseUrl)

let output
try {
  output = execFileSync('dev-browser', ['--ignore-https-errors', '--headless', '--timeout', '30'], {
    input: script,
    encoding: 'utf8',
  })
} catch (error) {
  // The dev stack could not be probed. That is an infrastructure failure, not
  // a failing implementation — the evaluator must report UNKNOWN, never 0.
  console.log(JSON.stringify({ score: 'UNKNOWN', failures: [], error: firstLine(error) }))
  process.exit(0)
}

// Playwright errors arrive with ANSI codes and a full stack; a report only
// needs the cause.
function firstLine(error) {
  return String(error.stderr ?? error.message)
    .replace(/\[[0-9;]*m/g, '')
    .trim()
    .split('\n')[0]
}

const { measured } = JSON.parse(output.trim().split('\n').at(-1))
console.log(JSON.stringify(evaluateVisual(spec.assertions, measured)))
