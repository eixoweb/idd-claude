import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const path = new URL('commands/review.md', root)
const review = () => readFileSync(path, 'utf8')

test('review exists as a command of its own', () => {
  assert.ok(existsSync(path), 'commands/review.md is missing')
})

test('review is the independent opinion, invoked on demand', () => {
  const flat = review().replace(/\s+/g, ' ')
  assert.match(flat, /superpowers:requesting-code-review/)
  assert.match(flat, /an author is the worst judge/i)
})

test('review scopes itself to the change rather than the working tree', () => {
  // Reviewing whatever happens to be uncommitted reviews someone else's work
  // as often as your own.
  assert.match(review(), /change-diff|changeDiff|the change's own diff/i)
})

test('review reports and does not gate', () => {
  // /idd:verify decides. A second thing that can fail a change is a second
  // thing to argue with.
  const flat = review().replace(/\s+/g, ' ')
  assert.match(flat, /does not gate|never fails the change|reports rather than decides/i)
})
