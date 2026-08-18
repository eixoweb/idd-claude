import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SCHEMA_NAME = 'idd-claude'
export const SCHEMA_NAMES = ['idd-claude', 'idd-claude-lite']

const SOURCE_DIRS = { 'idd-claude': 'schema', 'idd-claude-lite': 'schema-lite' }

const VERSION_STAMP = '.promoted-version'

export function defaultConfig() {
  return `schema: ${SCHEMA_NAME}
stack: javascript              # javascript | php (v2)

${VERIFICATION_BLOCK}`
}

const VERIFICATION_BLOCK = `verification:
  spec_as_source: false        # executable Gherkin - off by default
  runtime: true                # set to false only for a project with no test suite
  visual: true                 # dev-browser gate
  mutation: false              # mutation testing - off by default
  subagents: true              # one subagent per task
  floors:                      # a dimension below its floor -> RETRY
    spec: 80
    runtime: 100
    visual: 100
    code: 60
    mutation: 70
    acceptance: 100
  max_iterations: 5
  evaluator_model: sonnet

project:
  dev_stack_command: ""
  test_commands: []

rules: {}
`

const SCHEMA_LINE = /^schema:[ \t]*(\S+)[ \t]*$/m

/**
 * openspec init already writes a config.yaml — a comment-only one, with
 * `schema: spec-driven` and no verification block. Refusing to touch it, as an
 * all-or-nothing writer must, leaves the project unusable. So merge instead:
 * point the schema at ours, append the verification block when it is missing,
 * and never disturb a block the user has actually configured.
 *
 * Text-level on purpose: a YAML round trip would strip the explanatory
 * comments that make up most of that file.
 */
export function mergeConfig(source) {
  let out = String(source)

  const schemaMatch = out.match(SCHEMA_LINE)
  const previousSchema = schemaMatch ? schemaMatch[1] : null
  if (schemaMatch) {
    if (previousSchema !== SCHEMA_NAME) out = out.replace(SCHEMA_LINE, `schema: ${SCHEMA_NAME}`)
  } else {
    out = `schema: ${SCHEMA_NAME}\n${out}`
  }

  const verificationAdded = !/^verification:/m.test(out)
  if (verificationAdded) {
    out = `${out.replace(/\s*$/, '')}\n\n${VERIFICATION_BLOCK}`
  }

  return {
    source: out,
    previousSchema: previousSchema === SCHEMA_NAME ? null : previousSchema,
    verificationAdded,
    schemaChanged: previousSchema !== SCHEMA_NAME,
  }
}

export function promoteSchema({ pluginRoot, projectRoot, pluginVersion }) {
  const schemaPaths = {}
  for (const name of SCHEMA_NAMES) {
    const target = join(projectRoot, 'openspec', 'schemas', name)
    mkdirSync(target, { recursive: true })
    cpSync(join(pluginRoot, SOURCE_DIRS[name]), target, { recursive: true })
    writeFileSync(join(target, VERSION_STAMP), `${pluginVersion}\n`, 'utf8')
    schemaPaths[name] = target
  }

  const configPath = join(projectRoot, 'openspec', 'config.yaml')
  const configCreated = !existsSync(configPath)
  let configMerged = false
  let previousSchema = null

  if (configCreated) {
    writeFileSync(configPath, defaultConfig(), 'utf8')
  } else {
    const before = readFileSync(configPath, 'utf8')
    const merged = mergeConfig(before)
    configMerged = merged.source !== before
    previousSchema = merged.previousSchema
    if (configMerged) writeFileSync(configPath, merged.source, 'utf8')
  }

  return { schemaPaths, configPath, configCreated, configMerged, previousSchema }
}

export function promotedVersion(projectRoot, name = SCHEMA_NAME) {
  const stamp = join(projectRoot, 'openspec', 'schemas', name, VERSION_STAMP)
  return existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null
}

export function hasDrifted(projectRoot, pluginVersion) {
  const promoted = promotedVersion(projectRoot)
  return promoted !== null && promoted !== pluginVersion
}
