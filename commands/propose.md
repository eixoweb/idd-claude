---
name: propose
description: "Open an OpenSpec change at the right tier and generate its artifacts"
---

Open a change for the work described in the argument.

## Tier guard — run this first

If the work is a tactical fix, a docs-only change, a dependency bump, or a
feasibility question, **do not open a change**. Say so, say why, and stop. The
pipeline costs more than the work is worth, and the upstream schema
documentation says as much.

Otherwise pick the tier:

- **Bounded** — no new architectural pattern, no new external dependency, no
  security or migration complexity, no ambiguity needing a decision recorded:

  `openspec new change <id> --schema idd-claude-lite`

- **Architectural** — any of the above applies:

  `openspec new change <id> --schema idd-claude`

The schema is recorded in the change's `.openspec.yaml`; every later command
reads it back. Never touch `openspec/config.yaml` to switch tiers — it only
sets the default for changes created without `--schema`.

If `/idd:explore` already classified this work, use its verdict instead of
re-deciding.

## Then

Generate the artifacts in the order the schema allows, reading
`openspec instructions <artifact> --change <id>` for each. Apply the project
rules from `config.yaml`. Stop after each artifact and let the user read it.

## The council, on the intent artifacts

Author `proposal` and the `specs` through `superpowers`-style adversarial
review — the `adversarial-authoring` skill: one subagent drafts, another
challenges the draft, you reconcile the review yourself and write the final
artifact. On an architectural change, `design` goes through it too.

**Not every artifact.** `tasks.md` is mechanical, derived from specs that have
already been challenged, and the council is not free — two subagent round trips
apiece. Spend them where intent is decided, not where it is transcribed.

Beyond the reviewer's standing remit, have it check one thing explicitly:

> Every capability the proposal promises is covered by a SHALL in the specs, and
> no spec requirement is unreachable from the proposal.

That is the defect this pass exists to catch here, and it is worth naming
because it is the expensive one. Work that no requirement governs stays
invisible until the evaluator finds it — after the code is written, the tests
pass and the visual assertions are measured — and it costs a full BLOCK round
plus the fix loop behind it. The same finding, on a proposal of a few hundred
bytes, costs seconds.

Write the council notes beside the artifact, as the skill describes: they are
the record of what was challenged and what was rejected, which is what makes a
reconciliation reviewable instead of taken on trust.

If, while writing the proposal for a bounded change, one of the architectural
criteria turns out to apply, stop and tell the user to recreate the change
with the full schema. It is cheap now and expensive after `tasks.md` exists.
