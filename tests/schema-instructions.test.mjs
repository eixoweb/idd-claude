import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const artifact = (dir, id) =>
  parse(readFileSync(new URL(`${dir}/schema.yaml`, root), 'utf8')).artifacts.find(
    (a) => a.id === id,
  )

const instruction = (dir) => artifact(dir, 'tasks').instruction

const template = (dir) => readFileSync(new URL(`${dir}/templates/tasks.md`, root), 'utf8')

for (const dir of ['schema', 'schema-lite']) {
  test(`${dir}: the tasks instruction declares the keyword vocabulary`, () => {
    // A real run produced twelve tasks and ten parsed as type null. /idd:apply
    // dispatches on the keyword and on nothing else, so those ten had no
    // behaviour at all — and the only keyword that did appear was VISUAL,
    // because visual-verification is wired to this artifact and the rest of the
    // vocabulary was wired nowhere.
    const text = instruction(dir)
    for (const keyword of ['RED', 'GREEN', 'REFACTOR', 'VISUAL', 'ACCEPT']) {
      assert.match(text, new RegExp(`\\b${keyword}\\b`), `${keyword} is missing`)
    }
    assert.match(text.replace(/\s+/g, ' '), /keyword after its ordinal/i)
  })

  test(`${dir}: the tasks instruction orders RED before GREEN`, () => {
    // The workflow claimed the template generated RED/GREEN pairs "before a line
    // of code exists". It did not: the instruction was upstream's, untouched,
    // and the generated file wrote the constant first and its test second.
    const flat = instruction(dir).replace(/\s+/g, ' ')
    assert.match(flat, /Every GREEN is preceded by its RED/i)
    assert.match(flat, /same group/i)
  })

  test(`${dir}: the template shows the shape rather than describing it`, () => {
    const text = template(dir)
    assert.match(text, /\bRED\b/)
    assert.match(text, /\bGREEN\b/)
    assert.match(text, /\bVISUAL\b/)
    assert.match(text, /- \[ \] 1\.1/, 'the checkbox form the parser needs must survive')
  })
}

test('the upstream tasks instruction is not what ships', () => {
  // It was, for every version until now — and nothing tested it, unlike the
  // apply instruction next to it.
  for (const dir of ['schema', 'schema-lite']) {
    assert.doesNotMatch(
      instruction(dir),
      /^Create the task list that breaks down the implementation work\.\n\n\*\*IMPORTANT: Follow the template below exactly\.\*\*[\s\S]*Each task should be verifiable - you know when it's done\.$/,
      `${dir}: still carries the upstream tasks instruction verbatim`,
    )
  }
})

// ---- verification: the artifact still described the evaluator ----

for (const dir of ['schema', 'schema-lite']) {
  test(`${dir}: the verification artifact describes the report verify writes`, () => {
    // It described the evaluator's per-group, per-attempt scorecard — with
    // floors and an iteration cap — none of which has existed since the gate
    // became a single /idd:verify pass.
    const text = artifact(dir, 'verification').instruction
    assert.doesNotMatch(text, /evaluator|floors|attempt|iteration cap/i)
    assert.match(text, /\/idd:verify/)
    assert.match(text.replace(/\s+/g, ' '), /PASS WITH WARNINGS/)
    assert.match(text, /BLOCKED/)
  })

  test(`${dir}: the verification template carries no dead machinery`, () => {
    const text = readFileSync(new URL(`${dir}/templates/verification.md`, root), 'utf8')
    assert.doesNotMatch(text, /verdict-cli|Floors in force|Attempt/i)
    assert.match(text, /Completeness/)
    assert.match(text, /Correctness/)
    assert.match(text, /Coherence/)
  })
}
