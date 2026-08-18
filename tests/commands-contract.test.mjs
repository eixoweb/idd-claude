import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const commandsRoot = fileURLToPath(new URL('../commands/', import.meta.url))
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
    'review.md',
    'archive.md',
  ]) {
    assert.ok(existsSync(join(commandsRoot, name)), `missing command: ${name}`)
    const frontmatter = parseFrontmatter(read(name))
    assert.ok(frontmatter, `${name}: no frontmatter`)
    // The plugin namespace is prepended automatically, so a decorated name
    // renders as /idd:IDD: Init. The name is the bare command word.
    assert.equal(frontmatter.name, name.replace(/\.md$/, ''), `${name}: name must match the file`)
    assert.doesNotMatch(frontmatter.name, /[:\s]/, `${name}: no prefix or spaces in a command name`)
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

test('init gitignores the workspaces the tooling creates', () => {
  // A worktree is a git repo inside the project: untracked, a git add -A
  // commits it as an embedded repository.
  const init = read('init.md')
  assert.match(init, /\.claude\/worktrees\//)
  assert.match(init, /\.superpowers\//)
  assert.match(init, /embedded repo/i)
  // Regenerated before every dispatch, like the extracted .feature files.
  assert.match(init, /\.evaluator-input\.json/)
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

test('commands sit directly in commands/, not in a subdirectory', () => {
  // A subdirectory is not scanned: the commands simply do not exist on an
  // installed plugin. Nothing else in the suite could see that, because every
  // other test reads the files by path.
  const entries = readdirSync(commandsRoot, { withFileTypes: true })
  const nested = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  assert.deepEqual(nested, [], `commands must not be nested: ${nested.join(', ')}`)
  assert.equal(entries.filter((e) => e.name.endsWith('.md')).length, 7)
})

test('the plugin name is the command namespace the docs promise', () => {
  // Commands are namespaced by plugin name, so /idd:apply requires a plugin
  // literally called "idd".
  const plugin = JSON.parse(
    readFileSync(fileURLToPath(new URL('../.claude-plugin/plugin.json', import.meta.url)), 'utf8'),
  )
  assert.equal(plugin.name, 'idd')
  const market = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../.claude-plugin/marketplace.json', import.meta.url)),
      'utf8',
    ),
  )
  assert.ok(market.plugins.some((p) => p.name === 'idd'))
})

test('init wires the git discipline skill the way upstream does', () => {
  // Upstream reaches it through a one-line AGENTS.md instruction, not through
  // config rules — it governs the workflow, not one artifact.
  const init = read('init.md')
  assert.match(init, /AGENTS\.md/)
  assert.match(init, /openspec-git-discipline/)
})

test('propose has an --auto flag that removes the confirmations', () => {
  // Two prompts got in the way of a real run: a checkpoint after every artifact,
  // and "Good to proceed?" once grilling had already collected every answer.
  const propose = read('propose.md')
  const flat = propose.replace(/\s+/g, ' ')
  assert.match(propose, /--auto/)
  assert.match(flat, /Do not stop between artifacts/i)
  assert.match(flat, /proceed rather than asking whether to proceed/i)
})

test('--auto keeps the interview and the guards it cannot answer for', () => {
  // A flag that skipped the tier guard would let a change be opened faster that
  // should not be opened at all.
  const flat = read('propose.md').replace(/\s+/g, ' ')
  assert.match(flat, /never skips/i)
  assert.match(flat, /tier guard/i)
  assert.match(flat, /the interview itself/i)
})

test('propose says why the change folder is committed, not just that it is', () => {
  // Uncommitted, the base-ref derivation finds no introducing commit and falls
  // back to the repository root — every later diff carries the whole history.
  const flat = read('propose.md').replace(/\s+/g, ' ')
  assert.match(flat, /openspec-git-discipline/)
  assert.match(flat, /base ref/i)
  assert.match(flat, /root commit/i)
})
