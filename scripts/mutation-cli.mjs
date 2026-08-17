#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readMutationScore, UNKNOWN } from './lib/mutation.mjs'

const [since] = process.argv.slice(2)
const args = ['run']
// Scope to the diff: a full run re-executes the suite once per mutant and is
// prohibitive inside a per-group gate.
if (since) args.push('--since', since)

// `npx stryker` does not resolve the binary reliably — it falls through to
// `npm run stryker` and fails on a missing script. Call the local bin, which
// is where a devDependency install puts it.
const bin = join(process.cwd(), 'node_modules', '.bin', 'stryker')

try {
  execFileSync(bin, args, { encoding: 'utf8', stdio: 'pipe' })
} catch (error) {
  console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
  process.exit(0)
}

try {
  const report = JSON.parse(readFileSync('reports/mutation/mutation.json', 'utf8'))
  console.log(JSON.stringify({ score: readMutationScore(report) }))
} catch (error) {
  console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
}

function firstLine(error) {
  return String(error.stderr ?? error.message)
    .replace(/\[[0-9;]*m/g, '')
    .trim()
    .split('\n')[0]
}
