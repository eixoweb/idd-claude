#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { preflight } from './lib/preflight.mjs'

const [changeId, projectRoot = process.cwd()] = process.argv.slice(2)
if (!changeId) {
  console.error('usage: preflight-cli.mjs <changeId> [projectRoot]')
  process.exit(2)
}

const read = (...p) => readFileSync(join(projectRoot, ...p), 'utf8')

// `which` rather than running the tool: a probe that starts dev-browser's
// daemon costs seconds, and the question is only whether it is installed.
const onPath = (bin) => {
  try {
    execFileSync('which', [bin], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

let config
let schema
try {
  config = read('openspec', 'config.yaml')
  schema = parse(read('openspec', 'changes', changeId, '.openspec.yaml'))?.schema
} catch (error) {
  console.log(
    JSON.stringify({ ok: false, refusals: [`cannot read the change: ${error.message}`], notes: [] }),
  )
  process.exit(0)
}

const result = preflight({
  config,
  schema,
  tools: {
    devBrowser: onPath('dev-browser'),
    stryker: existsSync(join(projectRoot, 'stryker.config.json')),
    cucumber: existsSync(join(projectRoot, 'node_modules', '.bin', 'cucumber-js')),
    acceptanceDir: existsSync(join(projectRoot, 'acceptance-tests')),
  },
})

console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)
