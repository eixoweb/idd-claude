import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const lock = JSON.parse(readFileSync(join(root, 'skills-lock.json'), 'utf8'))

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

test('every locked skill is present and matches its recorded hash', () => {
  // The inherited lock claimed a hash matching neither the file shipped nor
  // anything upstream, and nothing read it — a lock nobody verifies is
  // decoration, and it drifts silently into a lie.
  for (const [name, entry] of Object.entries(lock.skills)) {
    const path = join(root, 'skills', name, 'SKILL.md')
    assert.ok(existsSync(path), `${name} is locked but not vendored`)
    assert.equal(sha256(path), entry.sha256, `${name} has drifted from its lock`)
  }
})

test('every lock entry says where it came from and at which commit', () => {
  // "vendored from GitHub" without a commit is not a pin: re-fetching gives
  // whatever main happens to hold, which is how the last copy went stale.
  for (const [name, entry] of Object.entries(lock.skills)) {
    assert.equal(entry.source, 'mattpocock/skills', `${name}: unexpected source`)
    assert.match(entry.commit, /^[0-9a-f]{40}$/, `${name}: commit must be a full sha`)
    assert.match(entry.skillPath, /^skills\/.+\/SKILL\.md$/, `${name}: skillPath must be a real path`)
  }
})
