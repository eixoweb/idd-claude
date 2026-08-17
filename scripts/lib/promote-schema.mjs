import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SCHEMA_NAME = 'idd-claude'

const VERSION_STAMP = '.promoted-version'

export function defaultConfig() {
  return `schema: ${SCHEMA_NAME}
stack: javascript              # javascript | php (v2)

verification:
  spec_as_source: false        # executable Gherkin - off by default
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
}

export function promoteSchema({ pluginRoot, projectRoot, pluginVersion }) {
  const schemaPath = join(projectRoot, 'openspec', 'schemas', SCHEMA_NAME)
  mkdirSync(schemaPath, { recursive: true })
  cpSync(join(pluginRoot, 'schema'), schemaPath, { recursive: true })
  writeFileSync(join(schemaPath, VERSION_STAMP), `${pluginVersion}\n`, 'utf8')

  const configPath = join(projectRoot, 'openspec', 'config.yaml')
  const configCreated = !existsSync(configPath)
  if (configCreated) writeFileSync(configPath, defaultConfig(), 'utf8')

  return { schemaPath, configPath, configCreated }
}

export function promotedVersion(projectRoot) {
  const stamp = join(projectRoot, 'openspec', 'schemas', SCHEMA_NAME, VERSION_STAMP)
  return existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null
}

export function hasDrifted(projectRoot, pluginVersion) {
  const promoted = promotedVersion(projectRoot)
  return promoted !== null && promoted !== pluginVersion
}
