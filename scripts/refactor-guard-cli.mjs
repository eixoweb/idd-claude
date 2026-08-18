#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { guardRefactor } from './lib/refactor-guard.mjs'

const [payloadPath] = process.argv.slice(2)
if (!payloadPath) {
  console.error('usage: refactor-guard-cli.mjs <evaluator payload path>')
  process.exit(2)
}

const result = guardRefactor(JSON.parse(readFileSync(payloadPath, 'utf8')))
console.log(JSON.stringify(result, null, 2))

// Non-zero on a block, like the preflight: the caller stops on the exit code
// rather than on its reading of the output.
process.exit(result.blocked ? 1 : 0)
