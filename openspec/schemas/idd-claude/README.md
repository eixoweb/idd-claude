# idd-claude OpenSpec Schema

A proposal-to-verification workflow for Claude Code, where implementation is
enforced by Superpowers rather than suggested.

Adapted from the [`intent-driven`](https://github.com/intent-driven-dev/openspec-schemas)
schema, with a `verification` artifact added and the `apply` block replaced by
hard TDD gates.

## Activate

In `openspec/config.yaml`:

```yaml
schema: idd-claude
```

`/idd:init` writes this for you, along with the `verification` block that
configures the gates.

## Artifact graph

```
proposal ─┬────────────────────> specs ──┐
          │                               ├──> tasks ──> apply ──> verification
          └──> design ──> adr ───────────┘
```

`design` and `adr` are conditional: create them only when their instruction's
criteria apply. A tactical fix needs neither.

`verification` depends on `tasks` rather than on `apply`, because `apply` is a
top-level block of the schema and not an artifact. Whether implementation is
complete is checked by `/idd:verify` — every checkbox in `tasks.md` ticked —
not by the graph.

## Do not edit in a target project

The copy under `openspec/schemas/idd-claude/` is promoted by `/idd:init` and
is overwritten on the next promotion. Change the source in the plugin repo
instead.

## Design

See `docs/superpowers/specs/` in the plugin repository.
