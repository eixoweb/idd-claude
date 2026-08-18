---
name: "IDD: Propose"
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

If, while writing the proposal for a bounded change, one of the architectural
criteria turns out to apply, stop and tell the user to recreate the change
with the full schema. It is cheap now and expensive after `tasks.md` exists.
