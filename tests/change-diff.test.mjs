import { test } from 'vitest'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { changeDiff } from '../scripts/lib/change-diff.mjs'

const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-diff-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  git('init', '-q')
  git('config', 'user.email', 't@t')
  git('config', 'user.name', 'T')
  writeFileSync(join(dir, 'README.md'), 'before\n')
  git('add', '-A')
  git('commit', '-qm', 'root')
  return { dir, git }
}

const openChange = (dir, git, id) => {
  mkdirSync(join(dir, 'openspec', 'changes', id), { recursive: true })
  writeFileSync(join(dir, 'openspec', 'changes', id, '.openspec.yaml'), 'schema: idd-claude-lite\n')
  git('add', '-A')
  git('commit', '-qm', `open ${id}`)
}

test('the base is the commit before the change was opened, never a guess', () => {
  // A hand-picked base is how a diff ends up carrying unrelated history.
  const { dir, git } = repo()
  const root = git('rev-parse', 'HEAD').trim()
  openChange(dir, git, 'c')
  writeFileSync(join(dir, 'src.js'), 'after\n')
  git('add', '-A')
  git('commit', '-qm', 'work')

  const r = changeDiff('c', dir)
  assert.equal(r.base, root)
  assert.equal(r.head, git('rev-parse', 'HEAD').trim())
})

test('the change own paperwork is not code under review', () => {
  const { dir, git } = repo()
  openChange(dir, git, 'c')
  writeFileSync(join(dir, 'src.js'), 'after\n')
  writeFileSync(join(dir, 'openspec', 'changes', 'c', 'tasks.md'), '# Tasks\n')
  git('add', '-A')
  git('commit', '-qm', 'work')

  const r = changeDiff('c', dir)
  assert.deepEqual(r.changedFiles, ['src.js'])
  assert.ok(r.artifactFiles.some((f) => f.includes('tasks.md')))
  assert.match(r.diff, /src\.js/)
  assert.doesNotMatch(r.diff, /tasks\.md/)
})

test('a change that touched no code yields an empty diff rather than everything', () => {
  const { dir, git } = repo()
  openChange(dir, git, 'c')
  const r = changeDiff('c', dir)
  assert.deepEqual(r.changedFiles, [])
  assert.equal(r.diff, '')
})
