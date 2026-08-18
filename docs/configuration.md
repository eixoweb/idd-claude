# Configuration reference

Everything lives in `openspec/config.yaml`.

`openspec init` writes that file first — a comment-only one with
`schema: spec-driven` and no verification block — so `/idd:init` **merges**
rather than writing or skipping. It points `schema` at `idd-claude`, appends
the `verification` and `project` blocks when they are missing, preserves the
explanatory comments, and never disturbs a block you have configured. Running
it twice changes nothing the second time.

## Full default

```yaml
schema: idd-claude
stack: javascript              # javascript | php (v2)

verification:
  spec_as_source: false        # executable Gherkin - off by default
  runtime: true                # set to false only for a project with no test suite
  visual: true                 # dev-browser gate
  mutation: false              # mutation testing - off by default
  subagents: true              # one subagent per task
  floors:                      # a dimension below its floor -> RETRY
    spec: 80
    runtime: 100
    visual: 100
    code: 60
    mutation: 70
    acceptance: 100
  max_iterations: 5
  evaluator_model: sonnet

project:
  dev_stack_command: ""
  test_commands: []

rules: {}
```

## Top level

### `schema`

The **default** schema for changes created without `--schema`. It does not lock
the project: the tier is chosen per change and recorded in the change's own
`.openspec.yaml`.

### `stack`

`javascript` today. `php` is reserved for the future Behat pack.

## `verification`

### Dimension switches

| Key | Default | Effect |
| --- | --- | --- |
| `runtime` | `true` | scores the project's test suite. Set `false` **only** to record that the project has no test suite |
| `visual` | `true` | scores measured dev-browser assertions |
| `mutation` | `false` | scores a diff-scoped Stryker run |
| `spec_as_source` | `false` | switches specs to fenced Gherkin **and** enables the `acceptance` dimension |

`spec` and `code` have no switch — see [dimensions.md](dimensions.md).

`spec_as_source` does double duty on purpose: it is the single source of truth
for the executable-spec workflow. The upstream template expressed the same
activation as a commented prose line in `rules:`, which is enough to steer
drafting but not enough to make an evaluator branch. One boolean, no drift.

### `subagents`

`true` dispatches one subagent per task through
`superpowers:subagent-driven-development`. `false` does the work directly —
appropriate for bounded changes, where the per-task isolation is not worth the
token cost.

### `worktree`

`false` by default. A worktree isolates the change from concurrent work — and
if nothing runs concurrently, it isolates from nothing while still costing a
duplicated install, an editor pointed at the wrong directory, and a dev server
serving the wrong tree.

Turn it on when task groups genuinely run in parallel, when you need the main
checkout free while a change is in flight, or when you want a workspace you can
delete without thinking.

**Never turn it on for a single-docroot stack** such as DDEV: the visual gate
probes what the server serves, so it would measure the main checkout while the
edits live in the worktree — a green gate on the wrong files.

### `floors`

A map of dimension → minimum score, 0 to 100. Any dimension below its floor
returns `RETRY`.

Validation is strict and fails loudly: an unknown dimension name, or a value
outside 0–100, throws with the offending key named. Omitted dimensions fall
back to the defaults above.

### `max_iterations`

Cap on the RETRY loop for a single group, default 5. Reaching it stops the run
and reports to the user. `BLOCK` verdicts do not count toward it.

### `evaluator_model`

`haiku`, `sonnet` (default) or `opus`. Sonnet is the default deliberately:
economising on the step that exists to be a safeguard is the wrong trade.

## `project`

### `dev_stack_command`

How to bring the app up, e.g. `pnpm dev`, `docker compose up -d`, `ddev start`.
Required when `visual: true`.

### `test_commands`

A list, e.g. `["pnpm test"]`. Required when `runtime: true` — `/idd:apply`
stops if the dimension is on and the list is empty, rather than letting every
group BLOCK.

## `rules`

Free-text project rules, appended by OpenSpec to the generation prompt of the
matching artifact. An upstream mechanism, unchanged.

```yaml
rules:
  design:
    - Must use c4-diagrams skill
  specs:
    - All API endpoints SHALL document authentication requirements.
  tasks:
    - Use pytest-django fixtures; never instantiate models without factory_boy.
```

## Recipes

**A front-end project with no test suite** — the visual gate is the test:

```yaml
verification:
  runtime: false
  visual: true
```

**A library, no UI:**

```yaml
verification:
  visual: false
  mutation: true      # the tests are the deliverable, so grade them
```

**A small bounded change, minimum cost:**

```yaml
verification:
  subagents: false
  mutation: false
```

## What `/idd:init` does not do

It never disturbs settings you have made — an existing `verification` block is
left exactly as it is, and only a `schema` line still pointing elsewhere is
rewritten. And it never touches
`openspec/schemas/idd-claude*/` in a way you should rely on — those are copies,
overwritten on the next promotion. Change the source in the plugin repo
instead.
