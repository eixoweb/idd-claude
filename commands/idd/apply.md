---
name: "IDD: Apply"
description: "Implement a change under enforced TDD, with a scored evaluator gate at the end of each task group"
---

Implement the change named in the argument, under hard gates.

## Before anything

Read `openspec/config.yaml`. Then check every enabled dimension can actually
be evaluated, and **refuse to start** if one cannot:

- `visual: true` but `dev-browser` is not on PATH, or
  `project.dev_stack_command` is empty → stop, say which is missing.
- `mutation: true` but no mutation tool is configured → stop, say so.
- `project.test_commands` empty → warn that `runtime` will report UNKNOWN, and
  that every group will therefore BLOCK. Ask whether to continue.

Never degrade silently. A dimension that is enabled but unevaluable stops the
run; it does not quietly disappear from the verdict.

## Session setup

1. Create an isolated workspace with `superpowers:using-git-worktrees`, unless
   the project's dev stack cannot serve a worktree — with a single-docroot
   stack such as DDEV it cannot, so work in place and say why.
2. Invoke `superpowers:test-driven-development`. This is mandatory and holds
   "no GREEN without a preceding RED" for the whole session.
3. Read `tasks.md` and group the work:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/tasks-cli.mjs" openspec/changes/<id>/tasks.md`

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

When `verification.subagents` is true, dispatch one subagent per task with
`superpowers:subagent-driven-development`. When false, do the work directly.

If subagents are unavailable, fall back to `superpowers:executing-plans` — but
note that it **does not transitively activate** TDD or code review, so in that
mode you must invoke the gates explicitly yourself.

**NEVER invoke `superpowers:requesting-code-review` directly during apply.**
The evaluator runs it internally; calling it here pays for the same review
twice.

## End of each group

Dispatch the `evaluator` agent. Pass it only the group's contract, the
change's specs, and the group's diff — never this conversation.

- `PASS` → next group.
- `RETRY` → append the fix tasks it generated to `tasks.md` and work them, then
  re-dispatch. Stop at `verification.max_iterations` and report to the user.
- `BLOCK` → fix the reported CRITICAL/HIGH findings, or the infrastructure
  problem, before re-dispatching. Do not count a BLOCK as an iteration of the
  RETRY loop: it is not a code-quality failure.

Record each round in `verification.md`.

## End of the change

Invoke `superpowers:verification-before-completion`, then hand off to
`/idd:verify`.
