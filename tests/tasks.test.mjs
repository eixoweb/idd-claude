import { test } from 'vitest'
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

test('only a level-two heading opens a group', () => {
  assert.equal(parseTasks('### 1. Not a group\n- [ ] 1.1 RED x\n').length, 0)
  assert.equal(parseTasks('# 1. Not a group\n- [ ] 1.1 RED x\n').length, 0)
})

test('a group heading must carry a number and a dot', () => {
  assert.equal(parseTasks('## Token generation\n- [ ] 1.1 RED x\n').length, 0)
  assert.equal(parseTasks('## 1 Token generation\n- [ ] 1.1 RED x\n').length, 0)
})

test('a multi-digit group number is read whole', () => {
  const [group] = parseTasks('## 12. Twelfth\n- [ ] 12.1 RED x\n')
  assert.equal(group.number, 12)
})

test('a task outside any group is ignored rather than crashing', () => {
  assert.deepEqual(parseTasks('- [ ] 1.1 RED orphan\n'), [])
})

test('the checkbox must be well formed', () => {
  const malformed = [
    '## 1. G\n- [] 1.1 RED x\n',
    '## 1. G\n- [ ]1.1 RED x\n',
    '## 1. G\n-[ ] 1.1 RED x\n',
    '## 1. G\n* [ ] 1.1 RED x\n',
  ]
  for (const source of malformed) {
    assert.equal(
      parseTasks(source)[0].tasks.length,
      0,
      `should not parse: ${JSON.stringify(source)}`,
    )
  }
})

test('an X in the checkbox is accepted in either case', () => {
  assert.equal(parseTasks('## 1. G\n- [X] 1.1 RED x\n')[0].tasks[0].done, true)
})

test('a single-space indent is not a continuation line', () => {
  const [group] = parseTasks('## 1. G\n- [ ] 1.1 VISUAL x\n url: /\n')
  assert.deepEqual(group.tasks[0].lines, [])
})

test('a continuation line must contain something', () => {
  const [group] = parseTasks('## 1. G\n- [ ] 1.1 VISUAL x\n      \n      url: /\n')
  assert.deepEqual(group.tasks[0].lines, ['url: /'])
})

test('continuation lines stop at the next task', () => {
  const [group] = parseTasks(
    '## 1. G\n- [ ] 1.1 VISUAL x\n      url: /\n- [ ] 1.2 RED y\n      note\n',
  )
  assert.deepEqual(group.tasks[0].lines, ['url: /'])
  assert.deepEqual(group.tasks[1].lines, ['note'])
})

test('an empty group is still a group', () => {
  const groups = parseTasks('## 1. Empty\n\n## 2. Also empty\n')
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].tasks, [])
})

test('a keyword is matched exactly, not as a prefix', () => {
  // REDO must not be read as RED.
  const [group] = parseTasks('## 1. G\n- [ ] 1.1 REDO the thing\n')
  assert.equal(group.tasks[0].type, null)
  assert.equal(group.tasks[0].description, 'REDO the thing')
})
