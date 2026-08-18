---
name: apply
description: "Implement a change under enforced TDD, then hand off to /idd:verify"
---

Implement the change named in the argument.

Apply implements. It does not judge its own work: the gate is `/idd:verify`,
once, at the end. A workflow that reviews itself between every task group ends
up costing more than the work it guards, and then stops being run at all.

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
`listening` on it. Start the stack only if it is not. Do not reconstruct the URL
from the command string — that works for a `http.server 8123` and for nothing
else.

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
| `VISUAL` | make the declared assertions true; check with `visual-cli.mjs` as you go |
| `ACCEPT` | run the Gherkin scenario (only when spec_as_source is on) |

Dispatch one subagent per task with `superpowers:subagent-driven-development`
when the tier calls for it, otherwise do the work directly.

If subagents are unavailable, fall back to `superpowers:executing-plans` — but
note that it **does not transitively activate** TDD, so in that mode you must
invoke the gate explicitly yourself.

A `VISUAL` task's assertions are checked here for your own feedback, not as the
gate — `/idd:verify` re-runs every one of them itself. Pass the group's `visual`
tasks in **one** call, never one call per task:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/visual-cli.mjs" '[{"ordinal":"1.3","lines":[...]}]' <devStack url>
```

## Before handing off

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/refactor-guard-cli.mjs" <change id> .
```

A REFACTOR task whose diff removes a test assertion is CRITICAL by design.
Weakening an assertion under cover of cleanup makes the suite agree with
whatever the code now does, and a diff shows it outright — so no judgement is
involved and none is asked for. On a non-zero exit, work the findings and re-run
it. Do not hand off until it is clean.

It is a guard, not a review: it recognises tests by convention, and everything
it cannot see is what `/idd:verify` is for.

## End of the change

Every checkbox ticked, the guard clean, the working tree committed. Then hand
off to `/idd:verify` — and let it do the verifying. Do not pre-run its
dimensions here to see whether it will pass.
