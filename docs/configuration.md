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
  mutation_threshold: 70       # the only partial score that means anything
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
drafting but not enough to make a verification step branch. One boolean, no drift.

### What is deliberately not here

**Subagents and worktrees are not settings.** How a run is shaped varies from
one change to the next, and the tier already says it: a bounded change works in
place without subagents, an architectural one may use both. Freezing that in
project config answers a per-change question in the wrong place, and adds two
knobs that have to be revisited every time the work changes shape.

The config holds project *facts* (`runtime`, `visual`) and *policy*
(`mutation`, `spec_as_source`, the mutation threshold). Nothing
that varies per change belongs in it.

### `mutation_threshold`

The mutation score, 0 to 100, below which `/idd:verify` fails. Default 70.

It replaced a table of per-dimension floors. `runtime`, `visual` and
`acceptance` had floors of 100 — a floor of 100 is a boolean wearing a number,
since any failure fails — and `spec` and `code` had floors only because a scored
evaluator emitted numbers for them. Those two are judged now, in prose, once.
Mutation is the one dimension where a partial score means something.

Out of range, or not a number, throws with the offending value named.

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
is what the preflight probes and what `/idd:verify` measures against.

### `test_commands`

A list, e.g. `["pnpm test"]`. Required when `runtime: true` — `/idd:apply`
stops if the dimension is on and the list is empty, rather than letting every
group BLOCK.

## `rules`

Free-text project rules, appended by OpenSpec to the generation prompt of the
matching artifact. An upstream mechanism, unchanged — **and the way the plugin's
skills are wired.**

`/idd:init` writes these defaults, mirroring intent-driven-template's own:

```yaml
rules:
  proposal:
    - Must use grilling skill
    # - Must use glossary skill
  design:
    - Must use c4-diagrams skill
    # - Must use glossary skill
  adr:
    - Must use architectural-decision-records skill
  specs:
    # - Must use spec-as-source skill
  tasks:
    - Must use visual-verification skill
    # - Must use spec-as-source skill
```

Why here rather than inside the commands: a rule in your config is yours to
delete. A skill named inside the plugin's prompts is not, and every project gets
it whether it fits or not.

`grilling` on the proposal is the intent challenge — it maps the design tree and
works it in rounds, asking the whole settled frontier at once with a recommended
answer per question, until nothing is left silently assumed. It costs your
attention rather than tokens, which is what makes it affordable where an
adversarial subagent pair was not.

`grill-me` is its trigger alias, vendored alongside it: upstream marks it
`disable-model-invocation: true`, so it is a phrase **you** type rather than
something the model fires. That is why the rule names `grilling` — routing a
model through a shim it may not invoke is a wiring that fails silently.

A rule that names a skill means the skill is **invoked**, not paraphrased.
Observed once: `Must use grilling skill` reached the agent correctly and was
satisfied with the native questioning UI instead — losing the rounds, the
recommended answer per question and the end condition, which is most of what
naming the skill was for.

Commented lines are opt-ins, listed rather than omitted so you can see what is
available without reading the plugin. **Comment the key too**, as above: a key
with only a comment under it parses as `null`, and OpenSpec answers every
`instructions` call with `Rules for 'specs' must be an array of strings,
ignoring this artifact's rules`. `spec-as-source` also pulls
`gherkin-authoring` and `acceptance-test-authoring`: skills reference each other,
so turning on the first is enough.

`openspec-git-discipline` is the exception. It governs the workflow rather than
one artifact, so `/idd:init` writes it as a line in `AGENTS.md` — again as
upstream does.

Your own rules go alongside them:

```yaml
rules:
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
