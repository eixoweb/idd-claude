import { test } from 'vitest'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const fixture = join(pluginRoot, 'tests', 'fixtures', 'js-toy')
const promote = join(pluginRoot, 'scripts', 'promote.mjs')

const freshProject = () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-e2e-'))
  cpSync(fixture, dir, { recursive: true })
  return dir
}

test('promote.mjs installs a schema that OpenSpec accepts', () => {
  const project = freshProject()

  execFileSync('node', [promote, project], { encoding: 'utf8' })

  assert.ok(existsSync(join(project, 'openspec', 'schemas', 'idd-claude', 'schema.yaml')))
  assert.ok(existsSync(join(project, 'openspec', 'schemas', 'idd-claude-lite', 'schema.yaml')))
  assert.ok(existsSync(join(project, 'openspec', 'config.yaml')))

  const schemas = execFileSync('openspec', ['schemas', '--json'], {
    cwd: project,
    encoding: 'utf8',
  })
  assert.match(schemas, /idd-claude/)
  assert.match(schemas, /idd-claude-lite/)
})

test('promote.mjs refuses to run when OpenSpec is too old', () => {
  const project = freshProject()
  let error
  try {
    execFileSync('node', [promote, project], {
      encoding: 'utf8',
      env: { ...process.env, IDD_FAKE_OPENSPEC_VERSION: '1.2.0' },
      stdio: 'pipe',
    })
  } catch (caught) {
    error = caught
  }

  // Assert on the captured stderr rather than on error.message: execFileSync
  // does not reliably fold the child's stderr into the message.
  assert.ok(error, 'promote.mjs must exit non-zero')
  assert.equal(error.status, 1)
  assert.match(error.stderr, /1\.9\.0/, 'the error must name the required minimum version')
  assert.equal(
    existsSync(join(project, 'openspec', 'config.yaml')),
    false,
    'nothing must be written when the prerequisite check fails',
  )
})
