import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const commandsRoot = fileURLToPath(new URL('../commands/idd/', import.meta.url))
const read = (name) => readFileSync(join(commandsRoot, name), 'utf8')

// Prompts are wrapped for readability, so a phrase can straddle a newline.
// Assertions about wording match against the collapsed text, otherwise the
// tests would quietly depend on where the paragraph happens to wrap.
const readFlat = (name) => read(name).replace(/\s+/g, ' ')

test('every command has frontmatter with a name and a description', () => {
  for (const name of [
    'init.md',
    'explore.md',
    'apply.md',
    'propose.md',
    'verify.md',
    'archive.md',
  ]) {
    assert.ok(existsSync(join(commandsRoot, name)), `missing command: ${name}`)
    const frontmatter = parseFrontmatter(read(name))
    assert.ok(frontmatter, `${name}: no frontmatter`)
    assert.ok(frontmatter.name?.length > 0, `${name}: no name`)
    assert.ok(frontmatter.description?.length > 0, `${name}: no description`)
  }
})

test('propose carries the tier guard', () => {
  const propose = read('propose.md')
  assert.match(propose, /tactical fix|docs-only|dependency bump/i)
  assert.match(propose, /do not (open|create) a change/i)
})

test('propose picks the schema per change rather than editing config', () => {
  const propose = read('propose.md')
  assert.match(propose, /--schema idd-claude-lite/)
  assert.match(propose, /--schema idd-claude\b/)
  assert.doesNotMatch(propose, /edit .*config\.yaml/i)
})

test('verify refuses to pass on unticked tasks', () => {
  assert.match(read('verify.md'), /every checkbox|all tasks .*ticked/i)
})

test('archive gates on a green verification', () => {
  const archive = read('archive.md')
  assert.match(archive, /verification\.md/)
  assert.match(archive, /guard(rail)?|not a lock/i, 'the guard must state it is bypassable')
})

test('explore delegates to brainstorming with a redefined terminal state', () => {
  const explore = readFlat('explore.md')
  assert.match(explore, /superpowers:brainstorming/)
  assert.match(explore, /spike/i)
  assert.match(explore, /bounded/i)
  assert.match(explore, /architectural/i)
  // The whole point: it must not let brainstorming write competing artifacts.
  assert.match(explore, /do not write.*design doc|never write.*design doc/i)
  assert.match(explore, /writing-plans/, 'it must name the skill it is overriding')
  assert.match(explore, /idd:propose/, 'it must hand off rather than implement')
})

test('no command references a command that does not exist', () => {
  const existing = readdirSync(commandsRoot).map((f) => f.replace(/\.md$/, ''))
  for (const file of readdirSync(commandsRoot)) {
    const body = read(file)
    for (const [, referenced] of body.matchAll(/\/idd:([a-z-]+)/g)) {
      assert.ok(
        existing.includes(referenced),
        `${file} references /idd:${referenced}, which has no command file`,
      )
    }
  }
})
