# Dimensions and verdicts

At the end of every task group an evaluator subagent scores the work on up to
six independent dimensions, then a verdict is computed **outside the model**.

## The six dimensions

| Dimension | Measures | Enabled by | Default floor |
| --- | --- | --- | --- |
| `spec` | proportion of the contract's SHALL statements the diff satisfies | always on | 80 |
| `code` | residual MEDIUM/LOW findings from the code review | always on | 60 |
| `runtime` | the project's test suite | `runtime` (default `true`) | 100 |
| `visual` | measured dev-browser assertions | `visual` (default `true`) | 100 |
| `mutation` | Stryker score on the group's changed files | `mutation` (default `false`) | 70 |
| `acceptance` | cucumber-js scenarios | `spec_as_source` (default `false`) | 100 |

`spec` and `code` cannot be switched off: they need no infrastructure — the
evaluator scores them from the diff and the review — so there is no legitimate
reason to.

## Floors, not a weighted average

A single dimension below its floor returns `RETRY`, whatever the others say.

This deliberately rejects the weighted-total model used elsewhere
(`spec × 0.4 + runtime × 0.4 + code × 0.2` against a threshold), for two
reasons.

**Compensation.** An average lets a weak dimension be redeemed by strong ones.
A group scoring spec 90 / runtime 100 / visual 60 / code 85 totals 86 and would
pass — while four visual assertions out of ten fail, so the rendering is wrong.
That is precisely the false positive this project exists to prevent. A test
pins it down:

```js
test('a weak dimension is never redeemed by strong ones', ...)
```

**Calibration.** Weights and a threshold look rigorous but rest on nothing. A
total of 86 has no absolute meaning. Floors express checkable rules instead:
`runtime: 100` says "no failing test passes the gate" — a binary property on
which a weight would make no sense.

Only `spec`, `code` and `mutation` keep a graduated floor, because they rest on
a judgement or a proportion rather than on a pass/fail execution.

## The three verdicts

| Verdict | When | What to do |
| --- | --- | --- |
| `PASS` | every enabled dimension is at or above its floor | next group |
| `RETRY` | at least one is below | work the generated `FIX` tasks, re-dispatch |
| `BLOCK` | a CRITICAL/HIGH review finding, or a dimension that could not be evaluated | fix the finding or the infrastructure |

`BLOCK` wins over `RETRY` when both apply.

## UNKNOWN is not zero

A dimension that could not be evaluated reports `"UNKNOWN"`, never `0`, and
`UNKNOWN` produces `BLOCK`.

The distinction matters: `0` blames the implementation and sends the agent
round the retry loop fixing code that was never the problem. `UNKNOWN` says the
environment is broken and stops the machine.

A dev stack that will not start, a mutation tool that cannot run, a missing
cucumber report — all `UNKNOWN`. A missing score for an enabled dimension is
also `UNKNOWN`, not zero: silence is not evidence of failure, it is absence of
evidence.

The governing principle, throughout: **a PASS obtained by skipping a dimension
is worse than a failure, because it lies.** `/idd:apply` refuses to start when
an enabled dimension is unevaluable, rather than degrading quietly.

## Applicable is not the same as enabled

A dimension can be enabled for the project and still have nothing to measure in
a given group. `visual` is the case that matters: its assertions live in
`VISUAL` tasks, so a group that has none makes no visual claim to check.

Neither obvious answer works. Scoring it 100 is a free pass — a group escapes
the visual gate by simply not declaring a `VISUAL` task. Reporting `UNKNOWN`
blocks every group that touches no interface, which is most of them.

So applicability is a third state, and it is **derived from the tasks
artifact**: `verdict-cli.mjs` reads `tasks.md`, finds the group, and drops
`visual` when the group contains no `VISUAL` task. Its output carries the
`applicable` list, which the verification report records.

The derivation matters more than the rule. A sentinel the evaluator could emit
— `"N/A"` — would only move the free pass: saying it would be enough to escape
the gate. Reading the artifact is not something a model can talk its way
around.

### The other half: should it have had one?

Applicability says a group without a `VISUAL` task has no visual claim to
check. It cannot say whether it *should* have had one — which would leave the
gate as strong as the diligence of whoever writes `tasks.md`.

So `verdict-cli` also takes the group's changed files and reports a warning
when the group touched a template or stylesheet and declared no visual
assertion:

```
group 3 changed styles/main.css but declares no VISUAL task
  — the visual gate did not run on this group
```

It **warns rather than fails**, deliberately. A stylesheet touched for a lint
fix has no visual consequence, and a gate that cannot tell the difference gets
routed around by whoever it inconveniences. Detection is deterministic; the
judgement stays human. The evaluator reports the warning as a finding even when
the verdict is `PASS`.

The extensions are the usual template and style ones — `.html`, `.css`,
`.scss`, `.vue`, `.jsx`, `.tsx`, `.svelte`, `.twig`, `.erb`, `.blade.php` —
and are overridable.

## What is still only a prompt instruction

The verdict, applicability and the coverage warning are all computed by code.
Two things are not, and it is worth knowing which:

**The iteration cap.** `max_iterations` is read from the config but no code
enforces it — the RETRY loop lives in `/idd:apply`'s prompt, and the cap is an
instruction to the agent running it. Making it deterministic would need an
orchestrator holding state across turns, which this plugin is not. Until then,
a runaway loop is caught by the human watching it.

**Whether the evaluator actually followed its sequence.** Its prompt tells it
to review before scoring, to re-run visual assertions rather than trust them,
and to call `verdict-cli`. Structural tests assert those instructions are
present in the file; nothing verifies an agent obeyed them on a given run. The
trial observed correct behaviour across three dispatches — that is evidence,
not a guarantee.

## The verdict is computed outside the model

The evaluator produces scores. It does **not** decide the verdict — it calls:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/verdict-cli.mjs" \
  openspec/config.yaml '<scores as JSON>' openspec/changes/<id>/tasks.md <group>
```

A model that arbitrates its own grade is a model that can negotiate with it.
Moving the decision out of the prompt makes it deterministic, and it is the one
part of the gate covered by real unit tests.

## Reading each dimension

### spec

The proportion of the contract's SHALL statements the diff satisfies. Below its
floor means the code does not do what the specs asked — the fix is code, or the
spec was wrong.

### code

Derived from `requesting-code-review`. CRITICAL and HIGH findings never reach
this score: they return `BLOCK` before any scoring happens. So `code` only ever
reflects the MEDIUM/LOW residue, which is why its floor is the most permissive
at 60.

### runtime

100 if every test passes, 0 if the command cannot run, otherwise the proportion
passing. Floor 100: no failing test passes the gate, ever.

### visual

Assertions declared in the group's `VISUAL` tasks, **re-run by the evaluator
itself** — it never reads the result the implementation session claimed.

```
url: /
viewport: 1440
assert .hero__title  font-size      68px
assert .hero         padding-block  224px ±1
count  .hero .layout-section > *    12
```

`assert` reads `getComputedStyle`; `count` reads `querySelectorAll().length`.
Separators are two spaces or more, so selectors may contain spaces. A line the
parser does not recognise is an error, not a comment — and a `VISUAL` task with
no assertion is rejected outright, because it would pass silently.

Prose is not an assertion. Write `count .grid > *  12`, never "→ 12 columns".

Screenshots are produced and attached to the report as evidence. They are never
the criterion: a screenshot cannot fail.

### mutation

Stryker mutates the source and re-runs the suite. A mutant that survives is a
behaviour your tests do not actually pin down.

```
score = (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage) × 100
```

`NoCoverage` counts against you — no test even executes that line, the worst
case, and the one a coverage-blind score would hide. `CompileError` and
`Ignored` are excluded: not the suite's fault.

Floor 70 rather than 100 because **equivalent mutants** — semantically
identical to the original, therefore unkillable — are permanent false positives
that no tool detects. Demanding 100 makes the gate impassable and pushes toward
absurd tests.

A surviving mutant is not a bug in the code: it is a test that would not have
caught the bug. Fix tasks must add or strengthen tests, never change behaviour.

Scoped to the group's changed files via `--since`; a full run is prohibitive in
a per-group gate.

### acceptance

cucumber-js over the Gherkin scenarios extracted from the specs. Only `passed`
counts — `undefined` (no step definition), `pending` (a stub) and `skipped`
(never ran) all fail their scenario, because none of them demonstrates the
behaviour.

The `.feature` files are regenerated from the specs on every run, so a stale
extraction can never be what is scored.

A failing scenario is a gap between the spec and the code. The findings must
say which of the two is wrong: fixing the code and fixing the spec are very
different tasks.
