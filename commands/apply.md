---
name: apply
description: "Implement a change under enforced TDD, with a scored evaluator gate at the end of each task group"
---

Implement the change named in the argument, under hard gates.

## Before anything

Read `openspec/config.yaml`. Then check every enabled dimension can actually
be evaluated, and **refuse to start** if one cannot:

- `visual: true` but `dev-browser` is not on PATH, or
  `project.dev_stack_command` is empty → stop, say which is missing.
- `mutation: true` but no `stryker.config.json` in the project → stop, say so.
- `spec_as_source: true` but `acceptance-tests/` is missing, or `cucumber-js`
  is not installed in the project → stop, say which. Run `/idd:init --acceptance`
  to scaffold it.
- `runtime: true` (the default) but `project.test_commands` is empty → stop.
  Either configure the commands, or set `runtime: false` to record that this
  project has no test suite. Do not proceed with the dimension enabled and
  nothing to run: every group would BLOCK.
- `runtime: false` → say so at the start of the run. The change will be gated
  on `spec`, `code` and whatever else is enabled, and on nothing executable.

Never degrade silently. A dimension that is enabled but unevaluable stops the
run; it does not quietly disappear from the verdict.

## Session setup

1. **Decide the shape of the run from the tier, and say what you chose.**

   The tier comes from `/idd:explore`, or from the schema the change was
   created with — `idd-claude-lite` is bounded, `idd-claude` is architectural.
   It already answers both questions below; neither is a project setting,
   because both vary from one change to the next.

   | | Bounded | Architectural |
   | --- | --- | --- |
   | subagents | no — do the work directly | one per task, via `superpowers:subagent-driven-development` |
   | worktree | no — work in place on the current branch | `superpowers:using-git-worktrees`, when groups run in parallel or the workspace should be disposable |

   A worktree isolates a change from concurrent work. One person doing one
   thing has no concurrency to isolate from, and the branch already protects
   the main line — so the default for a bounded change is to work in place.

   **One hard rule, not a judgement.** If `visual` is enabled and the dev stack
   serves a single docroot — DDEV, for one — never use a worktree. The gate
   probes what the server serves, so it would score the main checkout while the
   edits live elsewhere: green on the wrong files.
2. Invoke `superpowers:test-driven-development`. This is mandatory and holds
   "no GREEN without a preceding RED" for the whole session.
3. Read `tasks.md` and group the work:
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

**Gather its inputs and pass them in the dispatch. Do not tell it to go and
find them.** Its charter is that it receives only the contract, the specs and
the diff and does not go looking — a charter the dispatch has to make true, not
merely assert. Handing them over is also what keeps the dispatch short: an
evaluator that has to locate its own inputs spends most of its turns doing it.

Collect, before dispatching:

- the group's heading and its tasks, from `tasks.md` — or every group's, when
  evaluating a bounded change once;
- the assertion lines of each `VISUAL` task, as a JSON array per task, ready to
  pass to `visual-cli.mjs`;
- the change's spec files, in full;
- `git diff <base>..HEAD`, and the list of changed files as a JSON array;
- the base ref and the dev stack base URL.

Pass all of it in the prompt. Give it the paths it must *run* — the CLIs — not
the paths it must *read*.

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

Record each round in `verification.md`.

## End of the change

Invoke `superpowers:verification-before-completion`, then hand off to
`/idd:verify`.
