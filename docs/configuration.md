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
  dev_stack_url: ""        # required when visual: true, e.g. http://localhost:5173
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

### What is deliberately not here

**Subagents and worktrees are not settings.** How a run is shaped varies from
one change to the next, and the tier already says it: a bounded change works in
place without subagents, an architectural one may use both. Freezing that in
project config answers a per-change question in the wrong place, and adds two
knobs that have to be revisited every time the work changes shape.

The config holds project *facts* (`runtime`, `visual`) and *policy*
(`mutation`, `spec_as_source`, floors, iteration cap, evaluator model). Nothing
that varies per change belongs in it.

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

`haiku`, `sonnet` (default) or `opus`. Read by `/idd:apply` and passed to the
evaluator at dispatch, overriding the model in the agent's own frontmatter.

Sonnet is the default deliberately: economising on the step that exists to be a
safeguard is the wrong trade. Raise it to `opus` on a codebase where a missed
finding is expensive.

## `project`

### `dev_stack_command`

How to bring the app up, e.g. `pnpm dev`, `docker compose up -d`, `ddev start`.
Required when `visual: true`. `/idd:apply` runs it only when nothing is already
listening on `dev_stack_url`.

### `dev_stack_url`

The origin the visual assertions are measured against, e.g.
`http://localhost:5173` or `https://project.ddev.site`. Required when
`visual: true`, and declared rather than derived: a URL inferred from the
command works for `python3 -m http.server 8123` and for no real dev stack. It
is what the preflight probes and what the evaluator is handed at dispatch.

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
