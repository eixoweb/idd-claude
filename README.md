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
| dev-browser      | `npm install -g dev-browser && dev-browser install` (for the `visual` dimension) |
| Stryker          | `npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner` in the target project — only for the `mutation` dimension, which is off by default |
| cucumber-js      | `npm i -D @cucumber/cucumber` in the target project — only for the `acceptance` dimension, enabled by `spec_as_source` and off by default. `/idd:init --acceptance` scaffolds it |

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
