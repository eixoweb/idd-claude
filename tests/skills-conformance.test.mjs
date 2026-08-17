import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url))
const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const EXPECTED = [
  'acceptance-test-authoring',
  'adversarial-authoring',
  'architectural-decision-records',
  'c4-diagrams',
  'gherkin-authoring',
  'glossary',
  'grill-me',
  'openspec-git-discipline',
  'spec-as-source',
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

test('the adversarial agents are ported with Claude Code frontmatter', () => {
  for (const file of ['adversarial-author.md', 'adversarial-reviewer.md']) {
    const path = join(agentsRoot, file)
    assert.ok(existsSync(path), `missing agent: ${file}`)
    const frontmatter = parseFrontmatter(readFileSync(path, 'utf8'))
    assert.ok(frontmatter, `${file}: no frontmatter block`)
    assert.equal(frontmatter.name, file.replace(/\.md$/, ''))
    assert.ok(frontmatter.description?.length > 0, `${file}: description must not be empty`)
    // OpenCode routes to other vendors; Claude Code only accepts these tiers.
    assert.ok(
      ['haiku', 'sonnet', 'opus'].includes(frontmatter.model),
      `${file}: model must be a Claude Code tier, got "${frontmatter.model}"`,
    )
    assert.equal(frontmatter.mode, undefined, `${file}: "mode" is OpenCode-only, drop it`)
  }
})
