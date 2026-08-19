# Dimensions and the verdict

`/idd:verify` is the workflow's only gate. It asks two different kinds of
question, and keeping them apart is the whole design:

- **What a script can measure** — does the suite pass, do the assertions hold,
  do the mutants die, do the scenarios run. Measured by `verify-cli.mjs`, in one
  command, with the verdict over them computed outside the model.
- **What only a reading can settle** — is this the code the change asked for.
  Judged once, in prose, at the end.

## The measured dimensions

| Dimension | Measures | Enabled by | Passes when |
| --- | --- | --- | --- |
| `runtime` | the project's test suite | `runtime` (default `true`) | every command exits clean |
| `visual` | declared dev-browser assertions | `visual` (default `true`) | every assertion holds |
| `mutation` | Stryker score on the change's files | `mutation` (default `false`) | at or above `mutation_threshold` |
| `acceptance` | cucumber-js scenarios | `spec_as_source` (default `false`) | every scenario passes |

Three of the four are pass/fail. That is why there is **one** threshold in the
config rather than a table of floors: a floor of 100 is a boolean wearing a
number, and mutation is the only dimension where a partial score means
anything.

### Why not a weighted average

An average lets a weak dimension be redeemed by strong ones. A change scoring
runtime 100 / visual 60 would total well above any sensible threshold while four
assertions out of ten fail and the rendering is wrong. That is precisely the
false positive this project exists to prevent — so any failure fails, whatever
the others say.

## The judged dimensions

`spec` and `code` used to be scored by an evaluator subagent. They are not
numbers; they were only ever numbers because something had to compare them to a
floor. `/idd:verify` judges them as prose, once:

- **Completeness** — every SHALL has an implementation you can point at.
- **Correctness** — what was built matches what the requirement says, and every
  scenario is covered.
- **Coherence** — the change follows the design and the patterns already there.

There is no switch for these three. A judgement you can turn off is not a gate.

The code review is a fourth thing, and it does have a switch — `/idd:verify
--review`, or `/idd:review` on its own. It asks whether the code is good rather
than whether it does what the spec asked, and only the second is worth blocking
on. It remains the workflow's only outside opinion, which is why verify records
its absence in the report rather than leaving it to be assumed.

## UNKNOWN is not zero

A dimension that could not be evaluated reports `UNKNOWN`, never `0`, and
`UNKNOWN` produces `BLOCKED`.

The distinction matters: `0` blames the implementation and sends someone fixing
code that was never the problem. `UNKNOWN` says the environment is broken and
stops the machine.

A dev stack that will not start, a mutation tool that cannot run, a missing
cucumber report — all `UNKNOWN`. Silence is not evidence of failure; it is
absence of evidence.

The governing principle throughout: **a PASS obtained by skipping a dimension is
worse than a failure, because it lies.** Both `/idd:apply` and `/idd:verify` run
the preflight and refuse to start when an enabled dimension is unevaluable,
rather than degrading quietly at the end.

Verify needs its own check rather than trusting apply's: the config can change
between the two, and verify is run on its own often enough. A real run enabled
`mutation` after apply had passed, reached `UNKNOWN` and then `BLOCKED` at the
very end, and had to improvise a Stryker install to get past it.

## Applicable is not the same as enabled

A dimension can be enabled for the project and still have nothing to measure.
`visual` is the case that matters: its assertions live in `VISUAL` tasks, so a
change that declares none makes no visual claim to check.

Neither obvious answer works. Scoring it 100 is a free pass — escape the gate by
simply not declaring a task. Reporting `UNKNOWN` blocks every change that
touches no interface, which is most of them.

So the absence is reported rather than scored, and it is paired with a check on
the other half of the question: **should it have declared one?**
`visualCoverageWarning` reads the change's own diff and says so when it rendered
something and claimed nothing:

```
changed styles/main.css but declares no VISUAL task — the visual gate did not run
```

It **warns rather than fails**, deliberately. A stylesheet touched for a lint fix
has no visual consequence, and a gate that cannot tell the difference gets routed
around by whoever it inconveniences. Detection is deterministic; the judgement
stays human — and the warning is recorded in the report even when the outcome is
`PASS`.

The derivation matters more than the rule. A sentinel someone could *declare* —
`"N/A"` — would only move the free pass: saying it would be enough to escape.
Reading the diff is not something a model can talk its way around.

## Work no requirement governs

If the change delivers behaviour no `SHALL` covers, `/idd:verify` fails and says
so — and it does **not** write the missing requirement.

Whether the spec was incomplete or the work was out of scope has opposite
remedies: one grows the spec, the other drops the code. Only a human can say
which. Writing the requirement resolves it by making the code correct by
construction — the spec and the code then come out of the same round with nobody
in between.

A real run produced exactly this, and wrote a *good* requirement, which is what
makes it worth guarding against: a well-written retrofit is harder to notice than
a lazy one. The same finding reproduced identically on a later run, which is how
we know it is a property of the change rather than noise.

## The verdict over measurements is computed outside the model

`verify-cli.mjs` returns the verdict with the dimensions. The agent reports it;
it does not decide it.

A model that arbitrates its own grade is a model that can negotiate with it.
`scriptVerdict` is twelve lines and unit-tested: any `FAIL` fails, any `UNKNOWN`
blocks, and a real failure outranks a broken probe because it is the actionable
one.

What this does **not** give you is an agent structurally incapable of
misreporting. `/idd:verify` runs in the context that wrote the code. What stands
in for that independence: every number comes from a command whose output is
verbatim in the transcript, and the subjective half is delegated to a code
reviewer that is a separate agent. That is most of the guarantee the old
evaluator gave, for a fraction of what it cost — not all of it.

## Reading each dimension

### runtime

Each command in `project.test_commands`, run from the project root. Any non-zero
exit fails the dimension and the failing command is named. No failing test passes
the gate, ever.

### visual

Every `VISUAL` task in the change, re-run by `/idd:verify` itself — it never
reads the result the implementation session claimed. All of them go through **one**
browser session: measured, four sequential probes cost 2990 ms against 2224 ms
batched, and each separate invocation also cost a tool round trip worth far more
than either.

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

The URL they are measured against is `project.dev_stack_url`, declared rather
than derived: inferring it from the dev stack command works for a
`python3 -m http.server 8123` and for no real stack.

### mutation

Stryker mutates the source and re-runs the suite. A mutant that survives is a
behaviour your tests do not actually pin down.

```
score = (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage) × 100
```

`NoCoverage` counts against you — no test even executes that line, the worst
case, and the one a coverage-blind score would hide. `CompileError` and
`Ignored` are excluded: not the suite's fault.

The threshold is 70 rather than 100 because **equivalent mutants** —
semantically identical to the original, therefore unkillable — are permanent
false positives that no tool detects. Demanding 100 makes the gate impassable
and pushes toward absurd tests.

A surviving mutant is not a bug in the code: it is a test that would not have
caught the bug. The remedy is to add or strengthen tests, never to change
behaviour.

Scoped to the change's own files via its derived base; a full run is
prohibitive.

The run forces the `json` and `html` reporters on. Stryker enables `html` by
default and **not** `json` — which is the file the score is read from, so a
project with a perfectly valid config and no json reporter used to get a silent
`UNKNOWN` with nothing to explain it. A project that configured either reporter
keeps its own paths.

The html path travels back with the score and belongs in the verification
report. A mutation score is a number nobody can act on; the annotated source
behind it shows each surviving mutant on the line it survived, which is the list
of tests that would not have caught the bug.

### acceptance

cucumber-js over the Gherkin scenarios extracted from the specs. Only `passed`
counts — `undefined` (no step definition), `pending` (a stub) and `skipped`
(never ran) all fail their scenario, because none of them demonstrates the
behaviour.

The `.feature` files are regenerated from the specs on every run, so a stale
extraction can never be what is scored.

A failing scenario is a gap between the spec and the code. Say which of the two
is wrong: fixing the code and fixing the spec are very different tasks.
