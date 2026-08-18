# idd-claude

An OpenSpec workflow for Claude Code where the implementation phase is
**enforced** by Superpowers rather than suggested: mandatory TDD, a scored
evaluator subagent at the end of every task group, and measured visual
verification.

Forked from [intent-driven-template](https://github.com/intent-driven-dev/intent-driven-template),
which targets OpenCode.

## Why it exists

OpenSpec governs *planning*: proposals, specs, tasks, and a living spec tree
that answers "what does this system do today". Superpowers governs *execution*:
TDD, subagent dispatch, code review. Neither covers the other, and every
existing integration of the two leaves the same hole — the implementation phase
is described in prose and enforced by nothing.

The upstream schema's entire `apply` instruction reads:

> *Read context files, work through pending tasks, mark complete as you go.
> Pause if you hit blockers or need clarification.*

Three lines, no mention of a test. This fork replaces that with hard gates, and
adds a verification layer that a screenshot or a green suite cannot fake.

## Prerequisites

| Requirement      | Install                                                     | Needed for |
| ---------------- | ----------------------------------------------------------- | ---------- |
| OpenSpec ≥ 1.9.0 | `npm install -g @fission-ai/openspec@latest`                 | everything |
| Superpowers      | `/plugin install superpowers@claude-plugins-official`        | everything |
| dev-browser      | `npm install -g dev-browser && dev-browser install`          | the `visual` dimension |
| cucumber-js      | `npm i -D @cucumber/cucumber` in the target project          | the `acceptance` dimension (off by default) |
| Stryker          | `npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner` in the target project | the `mutation` dimension (off by default) |

## Install

```
/plugin marketplace add eixoweb/idd-claude
/plugin install idd@idd-claude
```

Then, from the root of a project you want to use it in:

```bash
openspec init --tools none
```
```
/idd:init
```

`/idd:init` copies both schemas into `openspec/schemas/`, writes
`openspec/config.yaml`, and asks for your dev-stack and test commands. Re-run it
after every plugin update — the commands warn you when the promoted schema and
the plugin have drifted apart.

## The five-minute model

```
/idd:explore   classify the work — and refuse to open a change when it does not deserve one
/idd:propose   create the change at the right tier, generate its artifacts
/idd:apply     implement under enforced TDD, evaluated at the end of every task group
/idd:verify    check completeness and the recorded verdicts
/idd:archive   fold the delta specs into the living specs
```

Not every change earns the full pipeline. A tactical fix gets none of it; a
bounded change skips the design document and the ADR. See
[docs/workflow.md](docs/workflow.md).

At the end of each task group an isolated evaluator subagent scores the work on
up to six dimensions and returns `PASS`, `RETRY` or `BLOCK`. There is no
weighted average: **every dimension has a floor, and one dimension below its
floor is enough to fail.** See [docs/dimensions.md](docs/dimensions.md).

## Documentation

| Page | What it covers |
| --- | --- |
| [docs/workflow.md](docs/workflow.md) | The pipeline, the three tiers, worked examples |
| [docs/dimensions.md](docs/dimensions.md) | The six scored dimensions, floors, verdicts |
| [docs/configuration.md](docs/configuration.md) | Every key of `openspec/config.yaml` |
| [docs/architecture.md](docs/architecture.md) | How the plugin is built, for anyone modifying it |
| `docs/superpowers/specs/` | The design documents and their rationale (French) |
| `docs/superpowers/plans/` | The implementation plans (French) |

## Development

```bash
npm install
npm test                          # 123 tests
./node_modules/.bin/stryker run   # mutation score, ~20s
```

MIT licensed.
