# Architecture

For anyone modifying the plugin. If you only want to *use* it, read
[workflow.md](workflow.md) instead.

## Layout

```
idd-claude/
├── .claude-plugin/          plugin.json (version drives drift detection), marketplace.json
├── commands/               explore, propose, apply, verify, archive, init
├── skills/                  10 skills — 8 from intent-driven-template, 2 from mattpocock, plus visual-verification
├── schema/                  the full OpenSpec schema + templates
├── schema-lite/             the bounded schema + templates
├── scripts/
│   ├── lib/                 all the logic, unit-tested
│   └── *-cli.mjs            thin shells that spawn external tools
├── tests/                   24 files, 222 tests
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
inventory labels as skills too. There are no agents: the workflow delegates its
one independent opinion to `superpowers:requesting-code-review` rather than
shipping a reviewer of its own.

## The one structural rule

**Logic lives in `scripts/lib/`; anything that spawns a process is a thin shell
in `scripts/`.**

| Pure, in `lib/` | Shell, in `scripts/` | Spawns |
| --- | --- | --- |
| `config.mjs` | | |
| `tasks.mjs` | `tasks-cli.mjs` | — |
| `visual.mjs` | `visual-cli.mjs` | dev-browser |
| `mutation.mjs` | `mutation-cli.mjs` | stryker |
| `acceptance.mjs` | `acceptance-cli.mjs` | extractor, cucumber-js |
| `preflight.mjs` | `preflight-cli.mjs` | `which`, a TCP probe |
| `refactor-guard.mjs` | `refactor-guard-cli.mjs` | git |
| `verify.mjs` | `verify-cli.mjs` | the test commands, dev-browser, stryker, cucumber |
| `change-diff.mjs` | | git |
| `promote-schema.mjs`, `openspec-version.mjs`, `frontmatter.mjs` | `promote.mjs` | openspec |

The split is why the interesting parts are testable without fixtures or
network: parsing a task file, deciding a verdict, reading a Stryker report are
all pure functions over strings and objects.

`stryker.config.json` mutates `scripts/lib/**` only — the shells are
deliberately untested, and mutating them would report them as uncovered.

## Prose the agent must interpret is a cost on every run

`/idd:apply` is read and reasoned over before it acts, so anything expressible
as a script belongs in one. Its preflight was five conditional branches in
prose — and because the prose did not say *how* to check that dev-browser was
available, an agent was free to check it by running it, which starts a daemon.
121 ms of `preflight-cli.mjs` replaced it, and the answer is now identical every
time.

The same reasoning applies to the verdict over the measured dimensions, to the
mutation scope, to the visual coverage warning, and to the REFACTOR rule — which
had been a line of prose the reviewing agent was asked to apply "automatically",
and which cost a 148-second dispatch to reach a verdict `refactor-guard-cli.mjs`
returns in 37 ms. The rule generalises: **if the answer is derivable, derive it —
the prompt is for judgement, not evaluation.**

The corollary is about batching. Four scripts invoked one at a time cost four
tool round trips, each worth far more than the script it wraps: four visual
probes measured 2990 ms sequential against 2224 ms in one session, while the
round trips around them cost tens of seconds each. `verify-cli.mjs` runs every
mechanical dimension in one call for that reason, not for the milliseconds.

`change-diff.mjs` is the single derivation of what a change contains — base,
head, and the code diff with the change's own `openspec/` paperwork excluded.
Everything downstream reads it, so there is no second opinion about the subject.

## Prompts are tested structurally

Commands and agents are Markdown prompts; they cannot be unit-tested. Instead,
tests assert that the design rules are *present in the text*:

```js
assert.doesNotMatch(apply, /evaluator|RETRY|BLOCK\b/)
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

- `verify-cli.mjs` → `status: "UNKNOWN"` when the dev stack is unreachable
- `mutation.mjs` → `UNKNOWN` when no mutant is scorable
- `acceptance.mjs` → `UNKNOWN` when no scenario ran
- any dimension whose tool would not run

`scriptVerdict` treats all of them identically and returns `BLOCKED`. No
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

Eight skills come from intent-driven-template's `.agents/skills/`. Their
frontmatter was already in Claude Code's format; only paths changed.

`grill-me` and `grilling` come straight from mattpocock/skills, pinned in
`skills-lock.json` by commit and sha256. They were re-fetched because what this
plugin shipped was a *fork of a fork*: byte-identical to intent-driven-template's
copy, which had itself vendored an older mattpocock revision. Upstream has since
split the skill in two — `grill-me` became a trigger shim carrying
`disable-model-invocation: true`, and `grilling` holds the content, now a
design-tree-in-rounds interview rather than the earlier one-question-at-a-time
loop.

The inherited lock claimed a hash matching neither the file shipped nor anything
upstream, and nothing read it. `tests/skills-lock.test.mjs` now recomputes the
sha256 of every locked skill and requires a full commit sha, so re-fetching
means re-fetching a known revision rather than whatever `main` holds that day.

**The wiring was vendored a version late.** Upstream declares which skill applies
to which artifact in `openspec/config.yaml` under `rules:`; this plugin shipped
`rules: {}` for several versions, leaving eight skills present and reachable by
nothing. A vendored skill nothing reaches is not clutter — it is a capability
that silently never happens, the same defect as a config key that does nothing.
`tests/skills-conformance.test.mjs` now fails if a skill is neither named in the
config template, nor in `init.md`, nor pulled by another skill — and it verifies
that last claim rather than trusting the list.

`tests/skills-conformance.test.mjs` asserts every skill's frontmatter `name`
matches its directory and that no OpenCode path survives.

**The adversarial council was ported and then removed.** Upstream runs an author
and a reviewer on different model families, so a draft is challenged from
genuinely outside. Claude Code routes to a single vendor, which makes it a
second pass rather than a second perspective — and it sat on top of OpenSpec's
own artifact generation, so it was a second author for something that already
had one. Wired onto `/idd:propose` it roughly doubled the cost of drafting, for
a challenge the reviewer's own prompt admits is not independent. The skill and
both agents are gone.

Where the upstream design still holds is placement: it reviews the intent and
implements freely. That is why the gate here is `/idd:verify` and not something
sitting between task groups.

## Test harness

vitest, `node:assert/strict` for assertions. The migration from `node:test`
happened for one reason: Stryker drives vitest natively and cannot drive
`node --test`.

```bash
npm test                          # 222 tests, ~2s
./node_modules/.bin/stryker run   # mutation score, ~20s
```

Current mutation score: **79.6%**, no file below 70. The weakest are
`tasks.mjs` at 71.8 and `frontmatter.mjs` at 72.2 — the next worthwhile targets.
Open `reports/mutation/index.html` after a run to see annotated source.

`refactor-guard.mjs` is worth a word: it landed at 67, below the threshold this
project sets for others, which matters more there than elsewhere — it is the
deterministic check the whole gate leans on. Pinning every branch of its two
regexes took it to 76.7. A guard whose own tests are weak is a guard nobody
should trust.

## Adding a dimension

1. Add it to `ALL_DIMENSIONS` in `config.mjs`, and to the enabling logic in
   `readVerification`.
2. Write the pure scorer in `scripts/lib/`, returning a status **or**
   `'UNKNOWN'`.
3. Write the shell in `scripts/`, which must catch tool failure and emit
   `UNKNOWN` rather than a failing score.
4. Run it from `verify-cli.mjs` — in the same call as the others, not as a
   separate command — and add a refusal in `lib/preflight.mjs` so a dimension
   that is enabled but unevaluable stops the run at the start rather than at
   the end.
5. Add the key to `defaultConfig()` and document it in `configuration.md`.

Step 3 is where the mistakes happen. A tool exiting non-zero does not always
mean infrastructure failure — cucumber-js exits non-zero on *failing
scenarios*, which is a legitimate score. `acceptance-cli.mjs` only reports
UNKNOWN when no report was written at all.
