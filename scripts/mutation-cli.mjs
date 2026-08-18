#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chooseMutationScope, readMutationScore, UNKNOWN } from './lib/mutation.mjs'

const [baseRef] = process.argv.slice(2)

let mutateGlobs = ['**/*.mjs']
try {
  mutateGlobs = JSON.parse(readFileSync('stryker.config.json', 'utf8')).mutate ?? mutateGlobs
} catch {
  // No config: leave the default and let Stryker complain if it must.
}

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

const bin = join(process.cwd(), 'node_modules', '.bin', 'stryker')

try {
  execFileSync(bin, args, { encoding: 'utf8', stdio: 'pipe' })
} catch (error) {
  console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
  process.exit(0)
}

try {
  const report = JSON.parse(readFileSync('reports/mutation/mutation.json', 'utf8'))
  console.log(JSON.stringify({ score: readMutationScore(report), scope: scope.mode }))
} catch (error) {
  console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
}

function firstLine(error) {
  return String(error.stderr ?? error.message)
    .replace(/\[[0-9;]*m/g, '')
    .trim()
    .split('\n')[0]
}
