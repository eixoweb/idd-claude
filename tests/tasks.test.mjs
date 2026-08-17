import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TASK_TYPES, parseTasks } from '../scripts/lib/tasks.mjs'

const SOURCE = `# Tasks

## 1. Token generation
- [x] 1.1 RED — an unknown email creates nothing
- [x] 1.2 GREEN — implement requestToken
- [ ] 1.3 VISUAL — hero block on /
      viewport: 1440
      assert  .hero  padding-block  → 224px
- [ ] 1.4 REFACTOR — clean up, tests stay green

## 2. Expiry
- [ ] 2.1 RED — an expired token is refused
- [ ] 2.2 Write the docs
`

test('the six task types are declared', () => {
  assert.deepEqual(
    [...TASK_TYPES].sort(),
    ['ACCEPT', 'FIX', 'GREEN', 'REFACTOR', 'RED', 'VISUAL'].sort(),
  )
})

test('groups are parsed with their number and title', () => {
  const groups = parseTasks(SOURCE)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].number, 1)
  assert.equal(groups[0].title, 'Token generation')
  assert.equal(groups[1].number, 2)
})

test('the keyword after the ordinal decides the type', () => {
  const [group] = parseTasks(SOURCE)
  assert.deepEqual(
    group.tasks.map((t) => t.type),
    ['RED', 'GREEN', 'VISUAL', 'REFACTOR'],
  )
})

test('a task with no known keyword has a null type rather than being dropped', () => {
  const [, second] = parseTasks(SOURCE)
  const plain = second.tasks.find((t) => t.ordinal === '2.2')
  assert.ok(plain, 'the untyped task must still be parsed')
  assert.equal(plain.type, null)
  assert.equal(plain.description, 'Write the docs')
})

test('checkbox state is captured', () => {
  const [group] = parseTasks(SOURCE)
  assert.deepEqual(
    group.tasks.map((t) => t.done),
    [true, true, false, false],
  )
})

test('indented continuation lines stay attached to their task', () => {
  const [group] = parseTasks(SOURCE)
  const visual = group.tasks.find((t) => t.type === 'VISUAL')
  assert.equal(visual.lines.length, 2)
  assert.match(visual.lines[0], /viewport: 1440/)
  assert.match(visual.lines[1], /padding-block/)
})

test('the ordinal letter never decides the type', () => {
  // 1.Z is the convention for a last-in-group task upstream; it must not be
  // treated as special. Only the keyword counts.
  const groups = parseTasks('## 1. G\n- [ ] 1.Z GREEN — still a GREEN task\n')
  assert.equal(groups[0].tasks[0].type, 'GREEN')
  assert.equal(groups[0].tasks[0].ordinal, '1.Z')
})

test('an em dash is optional after the keyword', () => {
  const groups = parseTasks('## 1. G\n- [ ] 1.1 RED write the failing test\n')
  assert.equal(groups[0].tasks[0].type, 'RED')
  assert.equal(groups[0].tasks[0].description, 'write the failing test')
})
