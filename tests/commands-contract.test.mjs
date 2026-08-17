import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const commandsRoot = fileURLToPath(new URL('../commands/idd/', import.meta.url))
const read = (name) => readFileSync(join(commandsRoot, name), 'utf8')

test('every command has frontmatter with a name and a description', () => {
  for (const name of ['init.md', 'apply.md', 'propose.md', 'verify.md', 'archive.md']) {
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
