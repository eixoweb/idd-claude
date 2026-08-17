#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCucumberScore, UNKNOWN } from './lib/acceptance.mjs'

const projectRoot = process.argv[2] ?? process.cwd()
const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const extractor = join(
  pluginRoot,
  'skills/acceptance-test-authoring/references/javascript/extract-gherkin.cjs',
)
const extractedDir = join(projectRoot, 'acceptance-tests', '.extracted')
const reportPath = join(projectRoot, 'acceptance-tests', 'report.json')

try {
  // Specs are the source: regenerate the .feature files every run, so a stale
  // extraction can never be what the gate scores.
  execFileSync('node', [extractor, join(projectRoot, 'openspec'), extractedDir], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  execFileSync(
    join(projectRoot, 'node_modules', '.bin', 'cucumber-js'),
    ['--format', `json:${reportPath}`],
    { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' },
  )
} catch (error) {
  // cucumber-js exits non-zero when scenarios fail, which is a real score, not
  // an infrastructure failure — so only report UNKNOWN if no report was
  // written at all.
  try {
    readFileSync(reportPath, 'utf8')
  } catch {
    console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
    process.exit(0)
  }
}

try {
  console.log(
    JSON.stringify({ score: readCucumberScore(JSON.parse(readFileSync(reportPath, 'utf8'))) }),
  )
} catch (error) {
  console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
}

function firstLine(error) {
  return String(error.stderr ?? error.message)
    .replace(/\[[0-9;]*m/g, '')
    .trim()
    .split('\n')[0]
}
