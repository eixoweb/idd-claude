---
name: "IDD: Explore"
description: "Think a change through before opening it, and decide whether it deserves the pipeline at all"
---

Explore the idea in the argument. **Nothing is written to disk in this
command** — its output is a decision and, at most, a validated design held in
the conversation.

## Delegate to brainstorming

Invoke `superpowers:brainstorming` on the idea. Let it classify the work, ask
its questions one at a time, propose approaches, and present its design.

## Override its terminal state

`brainstorming` normally ends by writing a design document under
`docs/superpowers/specs/` and invoking `superpowers:writing-plans`. **Do not
write that design doc and do not invoke writing-plans here.** Those outputs
would compete with OpenSpec's own `design.md` and `tasks.md`, which is the
exact duplication this project exists to avoid. This override is deliberate:
project instructions take precedence over a skill's default flow.

Instead, hand off according to the classification:

| Classification | What to do |
| --- | --- |
| **Spike** | Report the answer and stop. Open no change — a feasibility question does not earn a change folder. |
| **Bounded** | Report the short design, then `/idd:propose <topic>` — which will create the change with `--schema idd-claude-lite`. |
| **Architectural** | Report the approved design in full, then `/idd:propose <topic>` — which will create the change with `--schema idd-claude`. The design content you just validated becomes the `design.md` artifact; do not rewrite it from scratch there. |

Pass your classification explicitly to `/idd:propose` so it does not re-decide.

## Visual companion

`brainstorming` offers its browser companion by itself, just in time, and only
when a question is genuinely visual — choosing between two block layouts,
comparing two mockups. Never force it, and never offer it for a conceptual
question that merely concerns a UI topic.

It writes its mockups to `<project>/.superpowers/brainstorm/`. If that path is
not in `.gitignore`, add it before accepting.
