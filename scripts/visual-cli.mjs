#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { parseVisualSpec, buildProbeScript, evaluateVisualBatch } from './lib/visual.mjs'

const [tasksJson, baseUrl] = process.argv.slice(2)
if (!tasksJson || !baseUrl) {
  console.error('usage: visual-cli.mjs <visual tasks JSON: [{ordinal, lines}]> <baseUrl>')
  process.exit(2)
}

// The shape evaluator-input-cli already emits per group, passed straight
// through: assembling it by hand, once per task, is four chances to mistype it.
const tasks = JSON.parse(tasksJson)
if (!Array.isArray(tasks) || tasks.some((t) => !Array.isArray(t?.lines))) {
  console.error('expected the group\'s `visual` array: [{ordinal, lines}]')
  process.exit(2)
}

const specs = tasks.map((task) => ({ ...parseVisualSpec(task.lines), ordinal: task.ordinal ?? null }))

let output
try {
  output = execFileSync('dev-browser', ['--ignore-https-errors', '--headless', '--timeout', '30'], {
    input: buildProbeScript(specs, baseUrl),
    encoding: 'utf8',
  })
} catch (error) {
  // The dev stack could not be probed. That is an infrastructure failure, not
  // a failing implementation — the evaluator must report UNKNOWN, never 0.
  console.log(JSON.stringify({ score: 'UNKNOWN', tasks: [], error: firstLine(error) }))
  process.exit(0)
}

// Playwright errors arrive with ANSI codes and a full stack; a report only
// needs the cause.
function firstLine(error) {
  return String(error.stderr ?? error.message)
    .replace(/\[[0-9;]*m/g, '')
    .trim()
    .split('\n')[0]
}

const { measuredByTask } = JSON.parse(output.trim().split('\n').at(-1))
console.log(JSON.stringify(evaluateVisualBatch(specs, measuredByTask), null, 2))
