#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chooseMutationScope, readMutationScore, reporterPaths, UNKNOWN } from './lib/mutation.mjs'

const [baseRef] = process.argv.slice(2)

let configSource = '{}'
try {
  configSource = readFileSync('stryker.config.json', 'utf8')
} catch {
  // No config: leave the defaults and let Stryker complain if it must.
}

let mutateGlobs = ['**/*.mjs']
try {
  mutateGlobs = JSON.parse(configSource).mutate ?? mutateGlobs
} catch {
  // Malformed: same answer.
}

const reports = reporterPaths(configSource)

// Stryker has no --since. Work out what to mutate from the diff ourselves.
let scope = { mode: 'full', mutate: [] }
if (baseRef) {
  let changed = []
  try {
    changed = execFileSync('git', ['diff', '--name-only', `${baseRef}..HEAD`], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  } catch (error) {
    console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
    process.exit(0)
  }
  scope = chooseMutationScope(changed, mutateGlobs)
}

if (scope.mode === 'none') {
  // Nothing this diff touched is mutable, and no test moved either.
  console.log(JSON.stringify({ score: UNKNOWN, reason: 'no mutable file in the diff' }))
  process.exit(0)
}

const args = ['run']
if (scope.mode === 'scoped') args.push('--mutate', scope.mutate.join(','))
// Forced rather than assumed: json is where the score is read from and Stryker
// leaves it off by default, and html is what a human opens to see which mutants
// survived and where. A project that configured them keeps its own paths.
args.push('--reporters', 'json,html,clear-text')

const bin = join(process.cwd(), 'node_modules', '.bin', 'stryker')

try {
  execFileSync(bin, args, { encoding: 'utf8', stdio: 'pipe' })
} catch (error) {
  console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
  process.exit(0)
}

try {
  const report = JSON.parse(readFileSync(reports.json, 'utf8'))
  console.log(
    JSON.stringify({
      score: readMutationScore(report),
      scope: scope.mode,
      // The number says how much; this says where the survivors are.
      htmlReport: reports.html,
    }),
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
