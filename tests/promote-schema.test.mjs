import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import {
  SCHEMA_NAME,
  defaultConfig,
  promoteSchema,
  promotedVersion,
  hasDrifted,
} from '../scripts/lib/promote-schema.mjs'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const newProject = () => mkdtempSync(join(tmpdir(), 'idd-'))

test('promoteSchema copies both schemas into the project', () => {
  const project = newProject()
  const { schemaPaths } = promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })

  assert.deepEqual(Object.keys(schemaPaths).sort(), ['idd-claude', 'idd-claude-lite'])
  for (const [name, path] of Object.entries(schemaPaths)) {
    assert.equal(path, join(project, 'openspec', 'schemas', name))
    assert.ok(existsSync(join(path, 'schema.yaml')), `${name}: no schema.yaml`)
    assert.ok(existsSync(join(path, 'templates', 'proposal.md')), `${name}: no proposal template`)
  }
})

test('both promoted schemas are stamped with the plugin version', () => {
  const project = newProject()
  promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })
  assert.equal(promotedVersion(project), '0.1.0')
  assert.equal(promotedVersion(project, 'idd-claude-lite'), '0.1.0')
})

test('promoteSchema writes a default config when none exists', () => {
  const project = newProject()
  const { configCreated, configPath } = promoteSchema({
    pluginRoot,
    projectRoot: project,
    pluginVersion: '0.1.0',
  })
  assert.equal(configCreated, true)
  const config = parse(readFileSync(configPath, 'utf8'))
  assert.equal(config.schema, SCHEMA_NAME)
  assert.equal(config.verification.spec_as_source, false)
  assert.equal(config.verification.visual, true)
  assert.equal(config.verification.mutation, false)
  assert.equal(config.verification.floors.runtime, 100)
  assert.equal(config.verification.floors.visual, 100)
  assert.equal(config.verification.floors.mutation, 70)
  assert.equal(config.verification.max_iterations, 5)
})

test('promoteSchema never overwrites an existing config', () => {
  const project = newProject()
  mkdirSync(join(project, 'openspec'), { recursive: true })
  const configPath = join(project, 'openspec', 'config.yaml')
  writeFileSync(configPath, 'schema: idd-claude\nverification:\n  visual: false\n', 'utf8')

  const result = promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })

  assert.equal(result.configCreated, false)
  assert.equal(parse(readFileSync(configPath, 'utf8')).verification.visual, false)
})

test('promoteSchema stamps the plugin version it came from', () => {
  const project = newProject()
  promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })
  assert.equal(promotedVersion(project), '0.1.0')
})

test('hasDrifted is true only when a promoted version differs', () => {
  const project = newProject()
  assert.equal(hasDrifted(project, '0.1.0'), false, 'never promoted is not drift')
  promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })
  assert.equal(hasDrifted(project, '0.1.0'), false)
  assert.equal(hasDrifted(project, '0.2.0'), true)
})

test('defaultConfig is parseable YAML with spec_as_source off', () => {
  const config = parse(defaultConfig())
  assert.equal(config.verification.spec_as_source, false)
})
