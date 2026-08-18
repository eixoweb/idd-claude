import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  splitDiffFiles,
  visualAssertionsFor,
  selectGroups,
  dispatchCard,
} from '../scripts/lib/evaluator-input.mjs'
import { parseTasks } from '../scripts/lib/tasks.mjs'

const TASKS = `## 1. First
- [x] 1.1 RED a
- [x] 1.2 VISUAL b
      url: /
      count .a  1
- [x] 1.3 VISUAL c
      url: /other
      assert .b  color  red

## 2. Second
- [ ] 2.1 GREEN d
`

test('the review diff excludes the change paperwork', () => {
  // An evaluator does not review its own proposal.md. Carrying it inflates the
  // payload and dilutes the review.
  const { code, artifacts } = splitDiffFiles([
    'src/a.js',
    'openspec/changes/x/proposal.md',
    'openspec/changes/x/tasks.md',
    'tests/a.test.mjs',
  ])
  assert.deepEqual(code, ['src/a.js', 'tests/a.test.mjs'])
  assert.deepEqual(artifacts, ['openspec/changes/x/proposal.md', 'openspec/changes/x/tasks.md'])
})

test('living specs count as paperwork too', () => {
  const { code } = splitDiffFiles(['openspec/specs/cap/spec.md', 'src/a.js'])
  assert.deepEqual(code, ['src/a.js'])
})

test('a diff of nothing but paperwork leaves no code to review', () => {
  const { code, artifacts } = splitDiffFiles(['openspec/changes/x/tasks.md'])
  assert.deepEqual(code, [])
  assert.equal(artifacts.length, 1)
})

test('each VISUAL task yields its own ready-to-pass assertion array', () => {
  const [group] = parseTasks(TASKS)
  const probes = visualAssertionsFor(group)
  assert.equal(probes.length, 2)
  assert.deepEqual(probes[0], { ordinal: '1.2', lines: ['url: /', 'count .a  1'] })
  assert.deepEqual(probes[1], { ordinal: '1.3', lines: ['url: /other', 'assert .b  color  red'] })
})

test('a group with no VISUAL task yields nothing to probe', () => {
  const [, second] = parseTasks(TASKS)
  assert.deepEqual(visualAssertionsFor(second), [])
})

test('a bounded tier is evaluated as every group at once', () => {
  const groups = parseTasks(TASKS)
  assert.equal(selectGroups(groups, 'bounded', null).length, 2)
})

test('an architectural tier is evaluated one group at a time', () => {
  const groups = parseTasks(TASKS)
  const picked = selectGroups(groups, 'architectural', 2)
  assert.equal(picked.length, 1)
  assert.equal(picked[0].number, 2)
})

test('an architectural tier without a group number is an error, not a guess', () => {
  const groups = parseTasks(TASKS)
  assert.throws(() => selectGroups(groups, 'architectural', null), /group number/)
})

test('a group number that does not exist is an error', () => {
  const groups = parseTasks(TASKS)
  assert.throws(() => selectGroups(groups, 'architectural', 9), /group 9/)
})

const PAYLOAD = {
  changeId: 'c',
  tier: 'bounded',
  base: 'abc123^',
  devStackUrl: 'http://localhost:8123',
  groups: [{ number: 1, title: 'First', tasks: [{}, {}, {}], visual: [{}, {}] }],
  specs: [{ path: 'specs/a.md', content: 'x'.repeat(5000) }],
  changedFiles: ['src/a.js', 'src/b.js'],
  diff: 'y'.repeat(40000),
}

test('the dispatch card names the payload instead of carrying it', () => {
  // The main agent used to re-emit the whole payload into the Task prompt —
  // thousands of output tokens spent transcribing JSON, growing with the diff.
  const card = dispatchCard(PAYLOAD, '/tmp/p.json')
  assert.equal(card.payload, '/tmp/p.json')
  assert.equal(card.diff, undefined)
  assert.equal(card.specs, undefined)
  assert.ok(JSON.stringify(card).length < 400, 'a card the size of the payload saves nothing')
})

test('the card still says what is being dispatched, so the run is readable', () => {
  const card = dispatchCard(PAYLOAD, '/tmp/p.json')
  assert.equal(card.tier, 'bounded')
  assert.equal(card.base, 'abc123^')
  assert.equal(card.devStackUrl, 'http://localhost:8123')
  assert.deepEqual(card.groups, [{ number: 1, title: 'First', tasks: 3, visual: 2 }])
  assert.equal(card.changedFiles, 2)
  assert.equal(card.diffBytes, 40000)
})
