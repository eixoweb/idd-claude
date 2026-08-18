# idd-claude-lite OpenSpec Schema

The bounded-change workflow: a linear `proposal → specs → tasks → verification`
with no design document and no ADR.

## When to use it

A change is bounded when **none** of these apply: cross-cutting scope or a new
architectural pattern, a new external dependency or significant data model
change, security / performance / migration complexity, or ambiguity that needs
a technical decision recorded.

If any of them apply, use the full `idd-claude` schema instead.

## Create a change with it

```bash
openspec new change <id> --schema idd-claude-lite
```

The choice is recorded in `openspec/changes/<id>/.openspec.yaml`, and every
later command reads it back. Never edit `openspec/config.yaml` to switch
tiers — it only sets the default for changes created without `--schema`.

## Why a second schema rather than optional artifacts

OpenSpec's `requires` is a hard gate on file existence, and artifacts have no
optionality field — the documented fields are `id`, `generates`, `template`,
`instruction`, `requires`. With `design` missing, `adr` stays blocked and
`tasks` after it. Skipping is therefore impossible within one schema, and a
second graph is the supported way to express a shorter path.

## Escape hatch

The `proposal` instruction tells the agent to stop and ask for the change to be
recreated with the full schema if an architectural criterion turns out to apply.
That is the only cheap moment to notice — after `tasks.md` exists it is not.

## Artifact graph

```
proposal ──> specs ──> tasks ──> apply ──> verification
```
