---
name: review
description: "An independent code review of a change, on demand — reports, never gates"
---

Review the change named in the argument, or the current one if none is given.

## Why this is a command and not a step

`/idd:verify` asks whether the code does what the specs asked. This asks whether
the code is any good. They are different questions, and only the first is worth
blocking on — so the review is here, run when you want it, rather than on every
change whether or not anyone reads it.

It is also the workflow's **only independent opinion**. Everything else in
`/idd:verify` runs in the context that wrote the code, and an author is the worst
judge of whether their own work matches the intent. That is what makes this worth
running before a pull request, on anything you did not write, or when a change
touched more than its description suggested.

## Scope it to the change, not to the tree

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/refactor-guard-cli.mjs" <change id> .
```

Run this first — it is deterministic and costs 37ms, and a cleanup task that
removed a test assertion is a finding no review should have to notice.

Then take the change's own diff — base to HEAD, derived from the commit that
introduced its `.openspec.yaml`, with the `openspec/` paperwork excluded — and
review that. Not `git diff`: reviewing whatever happens to be uncommitted reviews
someone else's work as often as your own, and misses everything already
committed.

## The review

Invoke `superpowers:requesting-code-review` on that diff.

Give it the change's specs alongside. A reviewer who knows what the code was
meant to do distinguishes a missing edge case from a deliberate non-goal; one who
does not will report the non-goals as defects.

## Report

Findings by severity, each naming a file and a line. Say plainly which are worth
acting on now and which are notes.

**This does not gate.** `/idd:verify` decides whether a change passes; a second
thing that can fail it is a second thing to argue with. If the review turns up
something that should block, the honest move is to say so and let a human stop
the change — not to invent a second verdict.

If the change has already been verified, say whether these findings would have
changed that outcome. A `PASS` followed by an unmentioned CRITICAL is how a
report stops being trusted.
