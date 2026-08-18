import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'
import { defaultConfig } from '../scripts/lib/promote-schema.mjs'

const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url))
const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const EXPECTED = [
  'acceptance-test-authoring',
  'architectural-decision-records',
  'c4-diagrams',
  'gherkin-authoring',
  'glossary',
  'grill-me',
  'openspec-git-discipline',
  'spec-as-source',
  'visual-verification',
]

test('every ported skill is present', () => {
  for (const name of EXPECTED) {
    assert.ok(skillDirs.includes(name), `missing skill: ${name}`)
  }
})

test('every skill has frontmatter whose name matches its directory', () => {
  for (const dir of skillDirs) {
    const file = join(skillsRoot, dir, 'SKILL.md')
    assert.ok(existsSync(file), `${dir} has no SKILL.md`)
    const frontmatter = parseFrontmatter(readFileSync(file, 'utf8'))
    assert.ok(frontmatter, `${dir}: SKILL.md has no frontmatter block`)
    assert.equal(frontmatter.name, dir, `${dir}: frontmatter name must match the directory`)
    assert.ok(
      typeof frontmatter.description === 'string' && frontmatter.description.length > 0,
      `${dir}: description must be a non-empty string`,
    )
  }
})

test('no skill references an OpenCode path', () => {
  for (const dir of skillDirs) {
    const source = readFileSync(join(skillsRoot, dir, 'SKILL.md'), 'utf8')
    assert.doesNotMatch(source, /\.opencode\//, `${dir}: still references .opencode/`)
    assert.doesNotMatch(source, /\.agents\/skills\//, `${dir}: still references .agents/skills/`)
  }
})

const agentsRoot = fileURLToPath(new URL('../agents/', import.meta.url))

// A vendored skill nothing reaches is not clutter, it is a capability that
// silently never happens — the same defect as a config key that does nothing.
const PULLED_BY_ANOTHER_SKILL = ['gherkin-authoring', 'acceptance-test-authoring']

test('every vendored skill is reachable by something', () => {
  const config = defaultConfig()
  const init = readFileSync(new URL('../commands/init.md', import.meta.url), 'utf8')

  for (const dir of skillDirs) {
    const reachable =
      config.includes(dir) || init.includes(dir) || PULLED_BY_ANOTHER_SKILL.includes(dir)
    assert.ok(reachable, `${dir} is vendored but no rule, command or skill reaches it`)
  }
})

test('a skill claimed as pulled is really named by another skill', () => {
  // Otherwise the list above becomes the place drift hides.
  for (const dir of PULLED_BY_ANOTHER_SKILL) {
    const named = skillDirs
      .filter((other) => other !== dir)
      .some((other) => readFileSync(join(skillsRoot, other, 'SKILL.md'), 'utf8').includes(dir))
    assert.ok(named, `${dir} is listed as pulled but no other skill names it`)
  }
})
