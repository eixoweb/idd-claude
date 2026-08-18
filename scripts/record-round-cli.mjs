#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { appendRound } from './lib/round-record.mjs'

const [changeId, roundJson, projectRoot = process.cwd()] = process.argv.slice(2)
if (!changeId || !roundJson) {
  console.error('usage: record-round-cli.mjs <changeId> <roundJson> [projectRoot]')
  process.exit(2)
}

const path = join(projectRoot, 'openspec', 'changes', changeId, 'verification.md')
const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''

writeFileSync(path, `${appendRound(existing, JSON.parse(roundJson))}\n`, 'utf8')
console.log(`recorded in ${path}`)
