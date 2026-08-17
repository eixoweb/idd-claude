#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { readVerification } from './lib/config.mjs'
import { computeVerdict } from './lib/verdict.mjs'

const [configPath, scoresJson] = process.argv.slice(2)
if (!configPath || !scoresJson) {
  console.error('usage: verdict-cli.mjs <configPath> <scoresJson>')
  process.exit(2)
}

const { enabled, floors } = readVerification(readFileSync(configPath, 'utf8'))
const scores = JSON.parse(scoresJson)

console.log(JSON.stringify(computeVerdict({ scores, floors, enabled })))
