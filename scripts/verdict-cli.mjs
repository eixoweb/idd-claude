#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { readVerification } from './lib/config.mjs'
import { parseTasks } from './lib/tasks.mjs'
import { applicableDimensions, computeVerdict, visualCoverageWarning } from './lib/verdict.mjs'

const [configPath, scoresJson, tasksPath, groupNumber, changedFilesJson] = process.argv.slice(2)
if (!configPath || !scoresJson) {
  console.error(
    'usage: verdict-cli.mjs <configPath> <scoresJson> [tasksPath] [groupNumber] [changedFilesJson]',
  )
  process.exit(2)
}

const { enabled, floors } = readVerification(readFileSync(configPath, 'utf8'))
const scores = JSON.parse(scoresJson)

// When the caller says which group this is, applicability is read off the
// tasks artifact rather than taken on trust.
let group = null
if (tasksPath && groupNumber) {
  const groups = parseTasks(readFileSync(tasksPath, 'utf8'))
  group = groups.find((g) => g.number === Number(groupNumber)) ?? null
  if (!group) {
    console.error(`no group ${groupNumber} in ${tasksPath}`)
    process.exit(2)
  }
}

const applicable = applicableDimensions(enabled, group)
const verdict = computeVerdict({ scores, floors, enabled: applicable })

const warnings = []
if (group && enabled.includes('visual') && changedFilesJson) {
  const warning = visualCoverageWarning({ changedFiles: JSON.parse(changedFilesJson), group })
  if (warning) warnings.push(warning)
}

console.log(JSON.stringify({ ...verdict, applicable, warnings }))
