#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectOpenspec, MINIMUM_OPENSPEC } from './lib/openspec-version.mjs'
import { promoteSchema, hasDrifted } from './lib/promote-schema.mjs'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const projectRoot = resolve(process.argv[2] ?? process.cwd())
const pluginVersion = JSON.parse(
  readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'),
).version

// The fake version lets the end-to-end test exercise the refusal path without
// downgrading the real CLI.
const fake = process.env.IDD_FAKE_OPENSPEC_VERSION
const openspec = detectOpenspec(fake ? () => fake : undefined)

if (!openspec.installed) {
  console.error('OpenSpec is not installed. Run: npm install -g @fission-ai/openspec@latest')
  process.exit(1)
}
if (!openspec.satisfies) {
  console.error(
    `OpenSpec ${openspec.version ?? 'unknown'} is too old — ${MINIMUM_OPENSPEC} or newer is required.\n` +
      'Run: npm install -g @fission-ai/openspec@latest',
  )
  process.exit(1)
}

const drifted = hasDrifted(projectRoot, pluginVersion)
const { schemaPaths, configPath, configCreated, configMerged, previousSchema } = promoteSchema({
  pluginRoot,
  projectRoot,
  pluginVersion,
})

for (const [name, path] of Object.entries(schemaPaths)) {
  console.log(`Schema ${name} promoted to ${path} (plugin ${pluginVersion})`)
}
if (configCreated) {
  console.log(`Config written to ${configPath}`)
} else if (configMerged) {
  console.log(`Config merged at ${configPath}`)
  if (previousSchema) console.log(`  default schema was "${previousSchema}", now "idd-claude"`)
} else {
  console.log(`Config already set up at ${configPath}`)
}
if (drifted) {
  console.log(
    'The previously promoted schema was from a different plugin version — it has been refreshed.',
  )
}
