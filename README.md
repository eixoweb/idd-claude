# idd-claude

An OpenSpec workflow for Claude Code where the implementation phase is
*enforced* by Superpowers rather than suggested: mandatory TDD, a scored
evaluator subagent per task group, and measured visual verification.

Forked from [intent-driven-template](https://github.com/intent-driven-dev/intent-driven-template),
which targets OpenCode.

## Prerequisites

| Requirement      | Install                                            |
| ---------------- | -------------------------------------------------- |
| OpenSpec ≥ 1.9.0 | `npm install -g @fission-ai/openspec@latest`       |
| Superpowers      | `/plugin install superpowers@claude-plugins-official` |

## Install

```
/plugin marketplace add eixoweb/idd-claude
/plugin install idd-claude@idd-claude
```

Then, from the root of a project you want to use it in:

```
/idd:init
```

This copies the schema into `openspec/schemas/idd-claude/` and writes
`openspec/config.yaml`. Re-run it after every plugin update — the commands
warn you when the promoted schema and the plugin have drifted apart.

## Design

See `docs/superpowers/specs/` for the design documents and
`docs/superpowers/plans/` for the implementation plans.
