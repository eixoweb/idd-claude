# Architecture

For anyone modifying the plugin. If you only want to *use* it, read
[workflow.md](workflow.md) instead.

## Layout

```
idd-claude/
├── .claude-plugin/          plugin.json (version drives drift detection), marketplace.json
├── commands/               explore, propose, apply, verify, archive, init
├── agents/                  evaluator, adversarial-author, adversarial-reviewer
├── skills/                  10 skills — 9 ported from upstream, plus visual-verification
├── schema/                  the full OpenSpec schema + templates
├── schema-lite/             the bounded schema + templates
├── scripts/
│   ├── lib/                 all the logic, unit-tested
│   └── *-cli.mjs            thin shells that spawn external tools
├── tests/                   20 files, 183 tests
└── docs/superpowers/        design specs and implementation plans (French)
```

## Three names, on purpose

| Thing | Name | Why |
| --- | --- | --- |
| repository & marketplace | `idd-claude` | what the project is |
| plugin | `idd` | commands are namespaced by plugin name, so this is what makes them `/idd:apply` |
| OpenSpec schemas | `idd-claude`, `idd-claude-lite` | independent of the plugin; they live in the target project |

Commands must also sit **directly** in `commands/`, never in a subdirectory:
a nested one is not scanned, and the commands silently do not exist on an
installed plugin. `tests/commands-contract.test.mjs` asserts both the flat
layout and the plugin name, because nothing else in the suite could see the
difference — every other test reads the files by path.

Verify packaging without publishing:

```bash
claude --plugin-dir . plugin details idd
```

It should report 16 skills — ten real skills plus the six commands, which that
inventory labels as skills too.

## The one structural rule

**Logic lives in `scripts/lib/`; anything that spawns a process is a thin shell
in `scripts/`.**

| Pure, in `lib/` | Shell, in `scripts/` | Spawns |
| --- | --- | --- |
| `config.mjs` | | |
| `tasks.mjs` | `tasks-cli.mjs` | — |
| `verdict.mjs` | `verdict-cli.mjs` | — |
| `visual.mjs` | `visual-cli.mjs` | dev-browser |
| `mutation.mjs` | `mutation-cli.mjs` | stryker |
| `acceptance.mjs` | `acceptance-cli.mjs` | extractor, cucumber-js |
| `promote-schema.mjs`, `openspec-version.mjs`, `frontmatter.mjs` | `promote.mjs` | openspec |

The split is why the interesting parts are testable without fixtures or
network: parsing a task file, deciding a verdict, reading a Stryker report are
all pure functions over strings and objects.

`stryker.config.json` mutates `scripts/lib/**` only — the shells are
deliberately untested, and mutating them would report them as uncovered.

## Prompts are tested structurally

Commands and agents are Markdown prompts; they cannot be unit-tested. Instead,
tests assert that the design rules are *present in the text*:

```js
assert.match(apply, /NEVER invoke `superpowers:requesting-code-review` directly/)
assert.doesNotMatch(schema.apply.instruction, /work through pending tasks/)
```

The second is the important one: it fails if the upstream `apply` instruction
ever comes back. The hole this fork exists to fill is now guarded by a test.

One more guards a defect that got through review: **no command may reference a
command that does not exist.** `propose.md` pointed at `/idd:explore` for a
whole plan before the file existed.

Assertions about wording match against whitespace-collapsed text (`readFlat`),
so a paragraph rewrap never breaks a test.

## The UNKNOWN contract

Four independent paths converge on one literal string:

- `visual-cli.mjs` → `{score: "UNKNOWN"}` when the dev stack is unreachable
- `mutation.mjs` → `UNKNOWN` when no mutant is scorable
- `acceptance.mjs` → `UNKNOWN` when no scenario ran
- a missing score for an enabled dimension

`computeVerdict` treats all of them identically and returns `BLOCK`. No
conversion anywhere. If you add a dimension, emit the same string.

## Two schemas, one source

`schema-lite/` was generated from `schema/` by filtering the artifacts, not
hand-copied. If you change a shared artifact instruction, change it in
`schema/` and regenerate — the four shared artifacts (`proposal`, `specs`,
`tasks`, `verification`) must not drift.

`tests/schema-graph.test.mjs` and `tests/schema-lite-graph.test.mjs` lock both
dependency graphs, so a malformed edit fails before OpenSpec ever sees it.
`tests/schema-parity.test.mjs` locks the relationship between them: the three
shared instructions byte-identical, every shared template byte-identical, and
the lite proposal equal to the full one **plus** its bounded guard. "Must not
drift" was a rule in this file and nothing else until then.

## Schema promotion and drift

`promoteSchema()` copies both schemas into the target project and stamps each
with the plugin version in `.promoted-version`. `hasDrifted()` compares that
stamp to the running plugin's version.

Consequence of the "plugin carries the schema" model: the schema must be
re-promoted in every project after a plugin update. The drift warning is the
mitigation. OpenSpec's *stores* feature would remove the need entirely; it is
in beta, and migrating later is trivial because the schema content is
identical either way.

## Ported from upstream

Nine skills and the two adversarial agents come from
intent-driven-template's `.agents/skills/` and `.opencode/agent/`. Their
frontmatter was already in Claude Code's format; only paths and agent
frontmatter changed. `skills-lock.json` pins `grill-me`, itself vendored from
mattpocock.

`tests/skills-conformance.test.mjs` asserts every skill's frontmatter `name`
matches its directory and that no OpenCode path survives.

**One capability was lost in the port.** Upstream ran the adversarial author
and reviewer on different model families, so a draft was challenged from
genuinely outside. Claude Code routes to a single vendor: it is a second pass,
not a second perspective. The reviewer's own prompt says so.

## Test harness

vitest, `node:assert/strict` for assertions. The migration from `node:test`
happened for one reason: Stryker drives vitest natively and cannot drive
`node --test`.

```bash
npm test                          # 183 tests, ~2s
./node_modules/.bin/stryker run   # mutation score, ~20s
```

Current mutation score: **81%**, no file below 70. The weakest are
`frontmatter.mjs` and `tasks.mjs` at 72 — the next worthwhile targets. Open
`reports/mutation/index.html` after a run to see annotated source.

## Adding a dimension

1. Add it to `ALL_DIMENSIONS` and `DEFAULT_FLOORS` in `config.mjs`, and to the
   enabling logic in `readVerification`.
2. Write the pure scorer in `scripts/lib/`, returning a number **or**
   `'UNKNOWN'`.
3. Write the shell in `scripts/`, which must catch tool failure and emit
   `UNKNOWN` rather than 0.
4. Add a step to `agents/evaluator.md` pointing at the shell, and a
   pre-flight check in `commands/apply.md` that refuses to start when the
   dimension is enabled but unevaluable.
5. Add the key to `defaultConfig()` and to the verification templates.

Step 3 is where the mistakes happen. A tool exiting non-zero does not always
mean infrastructure failure — cucumber-js exits non-zero on *failing
scenarios*, which is a legitimate score. `acceptance-cli.mjs` only reports
UNKNOWN when no report was written at all.
