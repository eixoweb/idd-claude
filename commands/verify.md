---
name: verify
description: "The gate: measure the change, judge it against its specs, and write the report"
---

Verify the change named in the argument. This is the workflow's only gate —
everything before it implements, this decides.

## 1. Structure

Run `openspec validate --all --json` and report any structural failure.

Read `tasks.md`: **every checkbox must be ticked.** List any that are not and
stop — an unfinished change is not verifiable.

Confirm the working tree is clean and the change's commits exist.

## 2. Measure — one command

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-cli.mjs" <change id> .
```

It runs every mechanical dimension the config enables — the test commands, all
the change's VISUAL assertions in a single browser session, mutation against
the change's own base, the Gherkin scenarios — and returns each one's status
plus a `verdict` over them.

**One command on purpose.** These are four scripts; invoking them one at a time
costs four tool round trips, each of which costs more than the script it wraps.
Take its output as measured: re-running a dimension by hand to confirm it is
green is the one check that cannot fail.

A dimension reported `UNKNOWN` is infrastructure that would not answer, not a
failing change. The verdict is `BLOCKED`, and that is what you report — never
`FAIL`, and never a quiet `PASS`.

## 3. Judge

The measurements say the code runs. They do not say it is the code the change
asked for. Three dimensions, and no script can settle them:

- **Completeness** — every SHALL in the change's specs has an implementation.
  Name the file and lines for each; a requirement you cannot locate is a
  CRITICAL, not a benefit of the doubt.
- **Correctness** — what was built matches what the requirement says, and every
  `#### Scenario:` is covered by a test or by code you can point at.
- **Coherence** — the change follows the design and the patterns already in the
  codebase.

For the code itself, invoke `superpowers:requesting-code-review`. It reviews
independently, which is the point: an author is the worst judge of whether the
work matches the intent, and this is the one place in the workflow where an
outside opinion is worth its cost.

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
