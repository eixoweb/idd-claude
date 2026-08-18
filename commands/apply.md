---
name: apply
description: "Implement a change under enforced TDD, with a scored evaluator gate at the end of each task group"
---

Implement the change named in the argument, under hard gates.

## Before anything

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/preflight-cli.mjs" <change id> .
```

It answers every question this command needs before it starts, and it answers
them the same way every time. On a non-zero exit, report its `refusals`
verbatim and **stop** — a dimension that is enabled but unevaluable stops the
run rather than quietly disappearing from the verdict. Report its `notes` too.

On success it returns `tier`, `subagents` and `worktree`. Announce the shape you
are running in, then follow it:

- **bounded** — work in place on the current branch, no per-task subagents. One
  person doing one thing has no concurrency to protect, and the branch already
  guards the main line.
- **architectural** — `superpowers:using-git-worktrees`, and one subagent per
  task via `superpowers:subagent-driven-development`.

The shape is decided at this point — **do not re-derive it**. A worktree
listing, a branch check, a probe for a tool the script already reported on: the
answer is above, and re-asking is what makes the opening of a run slow.

**One hard rule the script cannot see**, and it applies only when `worktree` is
true: if the dev stack serves a single docroot — DDEV, for one — do not use a
worktree. The visual gate probes what the server serves, so it would score the
main checkout while the edits live elsewhere. Say so and work in place.

When `visual` is on, the preflight also returns `devStack`: the command, the
`url` the assertions are measured against, and whether something is already
`listening` on it. Start the stack only if it is not, and hand that same URL to
the evaluator. Do not reconstruct it from the command string — that works for a
`http.server 8123` and for nothing else.

## Session setup

1. Invoke `superpowers:test-driven-development`. Mandatory: it holds "no GREEN
   without a preceding RED" for the whole session.
2. Read the groups:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/tasks-cli.mjs" openspec/changes/<id>/tasks.md`

## Per task

Dispatch on the keyword **after** the ordinal — never on the ordinal itself.

| Keyword | What to do |
| --- | --- |
| `RED` | write the test, run it, confirm the failure mode matches the description |
| `GREEN` | minimal code, test green |
| `REFACTOR` | clean up at constant behaviour; touch no test assertion |
| `VISUAL` | run the declared assertions through dev-browser |
| `FIX` | apply the fix from the previous evaluation round |
| `ACCEPT` | run the Gherkin scenario (only when spec_as_source is on) |

Dispatch one subagent per task with `superpowers:subagent-driven-development`
when the tier calls for it (see step 1), otherwise do the work directly.

If subagents are unavailable, fall back to `superpowers:executing-plans` — but
note that it **does not transitively activate** TDD or code review, so in that
mode you must invoke the gates explicitly yourself.

**NEVER invoke `superpowers:requesting-code-review` directly during apply.**
The evaluator runs it internally; calling it here pays for the same review
twice.

## Evaluation

**When to evaluate depends on the tier — the cost of the gate has to be
proportionate to the change, or it stops being used.**

| | Bounded | Architectural |
| --- | --- | --- |
| when | **once, after the last group** | after each group |
| the evaluator sees | the whole change | that group's diff |

A bounded change is one unit of work. Splitting it into groups organises the
writing; it is not a reason to pay for the gate twice. Evaluating once covers
exactly the same code.

For an architectural change, evaluate per group — but **do not idle while the
verdict comes back.** Dispatch the evaluator in the background and start the
next group, unless the next group builds on the one being evaluated. When the
verdict lands:

- `PASS` → nothing to do, carry on.
- `RETRY` or `BLOCK` → stop the current group, work the fix tasks, re-dispatch.
  Work done meanwhile is not wasted: it is re-evaluated with its own group.

Only serialise when the groups genuinely depend on each other. Waiting on a
verdict for an independent group buys nothing and doubles the wall clock.

## Dispatching the evaluator

Use the model named in `verification.evaluator_model` (default `sonnet`), and
tell it the tier so it can calibrate its own depth: on a small diff it should
judge the code directly rather than invoke the full `requesting-code-review`
skill, which costs more than it finds on twenty lines.

**Gather its inputs with one command, and hand over the path it prints.**

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/evaluator-input-cli.mjs" <change id> <group|""> .
```

Pass the group number for an architectural change, an empty string for a
bounded one — it evaluates every group at once. It assembles everything the
evaluator needs — the tier, the derived base ref, the dev stack URL, the groups
with their tasks, each VISUAL task's assertion lines ready to pass to
`visual-cli.mjs`, the spec content, the changed code files and the diff —
**writes it to `.evaluator-input.json` in the change folder**, and prints a
short card naming that path.

The diff it assembles **excludes the change's own artifacts**. An evaluator has
no business re-reading the proposal it measures against, and carrying it
inflates the payload while diluting the review. The artifact files are listed
separately in the payload if you need to mention them.

**Run the automatic rule before dispatching anything:**

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/refactor-guard-cli.mjs" <the card's payload path>
```

A REFACTOR task whose diff removes a test assertion is CRITICAL by design. No
judgement is involved, so it does not need a round trip to reach one: on the run
that motivated this, the evaluator spent two and a half minutes returning a
verdict a millisecond of script returns. On a non-zero exit, treat it exactly as
a `BLOCK` — record the round, work the findings, re-run the guard — and dispatch
only once it is clean.

It is a guard, not a replacement: it recognises tests by convention, so the
evaluator still applies the same rule to what the convention misses.

**Dispatch the card's `payload` path — never the payload itself.** Transcribing
that JSON into the Task prompt is thousands of output tokens spent before the
evaluator has started, and it grows with the diff: the bigger the change, the
longer the wait before anything is reviewed. The card is there so you can say
what you are dispatching without reciting it.

Its charter is that it receives only the contract, the specs and the diff and
does not go looking — a charter the dispatch has to make true, not merely
assert. One prepared file is not going looking; a tour of the codebase is. Give
it the paths it must *run* — the CLIs — and the one path it must *read*.

Then act on the verdict:

- `PASS` → done, or next group.
- `RETRY` → append the fix tasks it generated to `tasks.md` and work them, then
  re-dispatch **incrementally**. Stop at `verification.max_iterations` and
  report to the user.
- `BLOCK` → fix the reported CRITICAL/HIGH findings, or the infrastructure
  problem, before re-dispatching. Do not count a BLOCK as an iteration of the
  RETRY loop: it is not a code-quality failure.

### Re-dispatching after a fix

A fix round is not a fresh evaluation. Most of the group is provably untouched,
and re-running everything is what makes a gate too slow to keep using.

Ask which dimensions the fix could have reached — do not decide it yourself:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/verdict-cli.mjs" openspec/config.yaml \
  '<scores so far>' openspec/changes/<id>/tasks.md <group> \
  '<group changed files>' '<files the fix touched>'
```

It returns a `recheck` list. Dispatch the evaluator with:

- the findings it must re-verify — always, that is the point of the round;
- the **fix diff**, not the whole group diff, for the review;
- only the dimensions in `recheck`. Carry the others forward at their previous
  scores, and say in the report that they were carried, not re-measured.

`runtime` is always in the list and always re-runs. It costs seconds and
catches damage anywhere, which is what makes skipping the expensive local
dimensions safe rather than optimistic.

### Record every round

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/record-round-cli.mjs" <change id> '<round as JSON>' .
```

Run it after **every** verdict, including a `BLOCK` — especially a `BLOCK`, which
is where a reader most wants to know what happened. The round is
`{group, attempt, status, scores, applicable, carried, findings, fixTasks}`.

This is the audit trail: what a reviewer reads in the PR instead of taking a
`PASS` on trust. A run that produced rounds and recorded none of them has
verified nothing anyone else can check — which is why it is a command rather
than a line the prompt hopes you follow.

## End of the change

Invoke `superpowers:verification-before-completion` — but do not read it as an
order to re-measure what the gate just measured. The evaluator ran the test
commands and re-ran every VISUAL assertion itself, minutes ago. Ask first
whether anything it measured has moved:

```
git diff --name-only <the payload's `head`>..HEAD -- ':!openspec/'
```

- **Empty** — no code changed since the evaluation; only `verification.md` and
  `tasks.md` moved, which this tooling excludes from review as paperwork. The
  verdict stands: report it as **carried, not re-measured**, and say so.
- **Non-empty** — something really did change after the gate. Name the files and
  re-run the dimensions they could have reached.

The evidence the skill asks for is the diff being empty. Re-running a green
suite to watch it be green again is not evidence, it is ceremony — and it is the
one case the check cannot fail, so it proves nothing that the emptiness does not.

Then hand off to `/idd:verify`.
