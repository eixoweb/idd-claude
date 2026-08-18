---
name: verify
description: "The gate: measure the change, judge it against its specs, and write the report"
---

Verify the change named in the argument. This is the workflow's only gate —
everything before it implements, this decides.

## 1. Structure

```
openspec validate <change id> --type change --strict --json
```

Scoped to this change on purpose. `--all` validates every change and spec in the
project, which makes one change's gate depend on the state of every other: a
half-written proposal in a neighbouring folder would fail a change that is
perfectly fine. `--strict` because this is a gate, not a lint.

Report any structural failure and stop.

Read `tasks.md`: **every checkbox must be ticked.** List any that are not and
stop — an unfinished change is not verifiable.

Confirm the working tree is clean and the change's commits exist.

## 2. Measure and review — start both, then read

Three things happen here and **they share no input**: the scripts need the
config and the tasks, the code review needs the diff, the reading needs the
specs. Run in sequence their wall clock is the sum, and the two slow ones are
the ones you can start and walk away from.

**Start both before you read anything.**

Measure, in the background:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-cli.mjs" <change id> .
```

It runs every mechanical dimension the config enables — the test commands, all
the change's VISUAL assertions in a single browser session, mutation against the
change's own base, the Gherkin scenarios — and returns each one's status plus a
`verdict` over them. **One command on purpose:** four scripts invoked one at a
time cost four tool round trips, each worth more than the script it wraps. With
`mutation` on it is the longest thing in the run, which is exactly why it should
not be blocking a reading it has nothing to do with.

Review, as a subagent: invoke `superpowers:requesting-code-review`. It reviews
independently, which is the point — an author is the worst judge of whether the
work matches the intent, and this is the one place in the workflow where an
outside opinion is worth its cost. Dispatch it and **do not idle** waiting on it.

**While they run**, judge the three dimensions in step 3 yourself. That reading is
yours to do and needs neither of them.

**Collect both before writing the outcome.** A report assembled from one strand
while another is still running has measured less than it claims, and this report
exists precisely so a reviewer does not have to take the run on trust.

Take the command's output as measured: re-running a dimension by hand to confirm
it is green is the one check that cannot fail.

A dimension reported `UNKNOWN` is infrastructure that would not answer, not a
failing change. The verdict is `BLOCKED`, and that is what you report — never
`FAIL`, and never a quiet `PASS`.

## 3. Judge

The measurements say the code runs. They do not say it is the code the change
asked for. Three dimensions, and no script can settle them.

They are OpenSpec's own — the ones `/opsx:verify` checks — and they are
reimplemented here rather than delegated to, for two reasons. That command lives
in OpenSpec's expanded workflow profile, not the default `core` one, so
delegating would make this gate depend on a profile the project may not have
enabled. And it is advisory by design: its own documentation says it "does not
block archive, but surfaces issues". This one decides. Wrapping an advisory tool
and re-deciding its output buys a dependency and loses nothing else.

- **Completeness** — every SHALL in the change's specs has an implementation.
  Name the file and lines for each; a requirement you cannot locate is a
  CRITICAL, not a benefit of the doubt.
- **Correctness** — what was built matches what the requirement says, and every
  `#### Scenario:` is covered by a test or by code you can point at.
- **Coherence** — the change follows the design and the patterns already in the
  codebase.

The code review dispatched in step 2 lands here: fold its findings in with these
three when you write the report.

**Work no requirement governs is a CRITICAL.** If the diff delivers behaviour
that no SHALL covers, say so and fail. Do **not** write the missing requirement:
whether the spec was incomplete or the work was out of scope is not yours to
decide, and the two have opposite remedies — one grows the spec, the other drops
the code. That a well-written requirement would come out of it makes this worse,
not better, because it is harder to notice afterwards.

## 4. Report

Invoke `superpowers:verification-before-completion` before claiming anything,
then write **one** report to `verification.md`: the measured dimensions with
their status verbatim from the command, the three judged dimensions with their
findings, and the outcome.

- **PASS** — every measured dimension green, no CRITICAL.
- **PASS WITH WARNINGS** — green, with findings worth recording that do not
  block. Name them; a warning nobody wrote down was not a warning.
- **FAIL** — a measured dimension failed, or a CRITICAL stands. Name the
  artifact to go back to: the spec, the tasks, or the code.
- **BLOCKED** — something could not be measured. Say which, and why.

Never soften an outcome. A PASS obtained by skipping a dimension is worse than
a failure, because it lies — and this report is what a reviewer reads in the
pull request instead of taking the run on trust.
