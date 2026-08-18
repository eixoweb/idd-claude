#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { parse } from 'yaml'
import { readProject, readVerification } from './lib/config.mjs'
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

// A TCP connect, not an HTTP request: the question is whether something holds
// the port, and a stack still booting must not read as absent.
const isListening = (url) =>
  new Promise((resolve) => {
    let target
    try {
      target = new URL(url)
    } catch {
      return resolve(false)
    }
    const port = Number(target.port) || (target.protocol === 'https:' ? 443 : 80)
    const socket = createConnection({ host: target.hostname, port })
    const settle = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(300)
    socket.once('connect', () => settle(true))
    socket.once('timeout', () => settle(false))
    socket.once('error', () => settle(false))
  })

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

let devStackListening = false
try {
  const { devStackUrl } = readProject(config)
  if (readVerification(config).enabled.includes('visual') && devStackUrl) {
    devStackListening = await isListening(devStackUrl)
  }
} catch {
  // A malformed config is preflight()'s to report with the offending key named,
  // not the probe's to fail on.
}

const result = preflight({
  config,
  schema,
  tools: {
    devBrowser: onPath('dev-browser'),
    stryker: existsSync(join(projectRoot, 'stryker.config.json')),
    cucumber: existsSync(join(projectRoot, 'node_modules', '.bin', 'cucumber-js')),
    acceptanceDir: existsSync(join(projectRoot, 'acceptance-tests')),
    devStackListening,
  },
})

console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)
