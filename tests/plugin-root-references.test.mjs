import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

// Live prompt surfaces only. docs/superpowers holds the design record: its
// plans describe paths as they were planned, which is history, not an
// instruction anything follows.
const LIVE = ['commands', 'agents', 'skills']

const REFERENCE = /\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9._/-]+)/g

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return entry.name.endsWith('.md') ? [path] : []
  })
}

test('every path a live prompt resolves through CLAUDE_PLUGIN_ROOT exists', () => {
  // The variable only resolves on an installed plugin, so a stale path here is
  // invisible until someone runs the command for real.
  const broken = []
  for (const dir of LIVE) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    for (const file of walk(base)) {
      const body = readFileSync(file, 'utf8')
      for (const [, relative] of body.matchAll(REFERENCE)) {
        if (!existsSync(join(root, relative))) {
          broken.push(`${file.slice(root.length)} → ${relative}`)
        }
      }
    }
  }
  assert.deepEqual(broken, [], `stale plugin-root references:\n  ${broken.join('\n  ')}`)
})

test('the references point at files, not directories', () => {
  const dirs = []
  for (const dir of LIVE) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    for (const file of walk(base)) {
      for (const [, relative] of readFileSync(file, 'utf8').matchAll(REFERENCE)) {
        const target = join(root, relative)
        if (existsSync(target) && statSync(target).isDirectory()) dirs.push(relative)
      }
    }
  }
  assert.deepEqual(dirs, [])
})
