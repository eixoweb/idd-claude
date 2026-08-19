# Workflow

## The pipeline

```
/idd:explore  →  /idd:propose  →  /idd:apply  →  /idd:verify  →  /idd:archive
   classify        artifacts       enforced TDD     the gate       living specs
```

Only `propose → apply → verify → archive` produces files. `explore` writes
nothing: its output is a decision.

`/idd:apply` runs `/idd:verify` itself when it is done — a gate you have to
remember is a gate that gets skipped. `--no-verify` stops after the
implementation, and leaves the change unverified rather than verified-by-omission.

**`/idd:explore` and `/idd:propose` do not both interview you.** Explore delegates
to `brainstorming`, which walks the design tree with you; propose's `grilling`
rule walks the same one. When explore ran first, it hands over its classification
*and* its validated design, and propose skips the second interview — asking only
about what explore left open.

`/idd:propose <id> --auto` drops the confirmations: no checkpoint between
artifacts, no "shall we proceed" once `grilling` has emptied its frontier, and
the change folder is committed for you. It still runs the tier guard and still
holds the interview — the flag removes prompts, not judgement. See
[the command](../commands/propose.md).

## Three tiers, and why they matter

The full pipeline is disproportionate for most changes. `/idd:explore`
delegates to `superpowers:brainstorming`, whose classifier decides which tier
applies — and the cheapest possible outcome is that no change folder is opened
at all.

| Tier | What runs | Order of magnitude |
| --- | --- | --- |
| **Spike** | nothing — the question is answered and the work stops | ~1 session |
| **Bounded** | `proposal → specs → tasks → apply`, no design, no ADR, no subagents, no worktree | ~5 sessions |
| **Architectural** | everything, one subagent per task, worktree | 20–30 sessions |

The tier is decided by a conversation *after* the change is understood, not by
a config flag set before. That is the point: the classifier is the only
component whose job is to **prevent** the pipeline from running.

### Do not open a change for

Tactical fixes, docs-only edits, dependency bumps, feasibility questions.
`/idd:propose` carries the same guard, so entering directly is safe.

## Two schemas

The tier maps to a schema, chosen **per change**:

```bash
openspec new change <id> --schema idd-claude       # architectural
openspec new change <id> --schema idd-claude-lite  # bounded
```

| Schema | Graph |
| --- | --- |
| `idd-claude` | `proposal → {specs, design}`, `design → adr`, `{specs, adr} → tasks → apply → verification` |
| `idd-claude-lite` | `proposal → specs → tasks → apply → verification` |

The choice is recorded in the change's `.openspec.yaml`, and every later
command reads it back. **Never edit `openspec/config.yaml` to switch tiers** —
it only sets the default for changes created without `--schema`.

Why two schemas rather than optional artifacts: OpenSpec's `requires` is a hard
gate on file existence, and artifacts have no optionality field. With `design`
missing, `adr` stays blocked and `tasks` after it. A shorter path needs its own
graph.

If a bounded change turns out to be architectural while you write the proposal,
stop and recreate it with the full schema. That is cheap before `tasks.md`
exists and expensive after.

## Task types

`tasks.md` drives `/idd:apply`. Dispatch is on the keyword **after** the
ordinal — never on the ordinal itself.

| Keyword | What happens |
| --- | --- |
| `RED` | write the test, run it, confirm the failure mode matches the description |
| `GREEN` | minimal code, test green |
| `REFACTOR` | clean up at constant behaviour — its diff must touch no test assertion |
| `VISUAL` | make the declared dev-browser assertions true |
| `ACCEPT` | run a Gherkin scenario (only when `spec_as_source` is on) |

```markdown
## 1. Token generation
- [ ] 1.1 RED — an unknown email creates nothing
- [ ] 1.2 GREEN — implement requestToken
- [ ] 1.3 VISUAL — hero block on /
      url: /
      viewport: 1440
      assert .hero__title  font-size  68px
- [ ] 1.4 REFACTOR — clean up, tests stay green
```

The `REFACTOR` rule is checkable, so it is checked by a script rather than
judged: `refactor-guard-cli.mjs` reads the change's diff and blocks when a
cleanup task removed a test assertion. Weakening an assertion under cover of
cleanup makes the suite agree with whatever the code now does — an integrity
problem, not a score. It costs 37 ms, and `/idd:apply` refuses to hand off until
it is clean.

## What forces TDD

Three layers, deliberately redundant:

1. `superpowers:test-driven-development` is invoked at session start and holds
   "no GREEN without a preceding RED" throughout.
2. The tasks **instruction and template** mandate a keyword after every ordinal
   and RED before its GREEN, so the order is written into the artifact instead
   of hoped for at apply time. Until 0.17.0 this line was a claim with nothing
   behind it: the instruction was still upstream's, and a real run produced
   twelve tasks of which ten carried no keyword at all.
3. `refactor-guard-cli.mjs` blocks the handoff if a `REFACTOR` task removed a
   test assertion — deterministically, before anything is judged.

## The gate

`/idd:verify` runs once, at the end, and it is the only thing that decides.
`/idd:apply` implements and hands off; it does not review itself. A workflow
that gates every task group ends up costing more than the work it guards —
measured on a small change, an evaluator subagent spent 8.3 minutes guarding 8.7
minutes of implementation — and then it stops being run at all.

Verify does four things, and only the first and the last are ordered:

1. **Structure** — the preflight first, so a dimension that is enabled but
   unevaluable stops the run here rather than surfacing as `BLOCKED` once the
   browser and the mutation run have been paid for. Then `openspec validate`
   scoped to this change, every checkbox ticked, working tree clean. An
   unfinished change is not worth measuring.
2. **Measure** — one call to `verify-cli.mjs` runs every mechanical dimension the
   config enables and returns a verdict over them. Started in the background.
3. **Judge** — Completeness, Correctness, Coherence. No code review by default:
   it answers whether the code is good, not whether it does what the spec asked,
   and only the second is worth blocking on. `--review` includes it.
4. **Report** — one `verification.md`: PASS, PASS WITH WARNINGS, FAIL or
   BLOCKED, written once every strand is in.

**Steps 2 and 3 share no input.** The scripts read the config and the tasks, the
spec-to-code reading reads the specs — so the scripts start first and the reading
happens while they run. With `mutation` on they are the longest thing in the run.

`BLOCKED` is not `FAIL`. It means a dimension could not be measured — a dev
stack that would not answer — and saying so is the point. See
[dimensions.md](dimensions.md).

## Multi-agent layer

| Skill | Role |
| --- | --- |
| `using-git-worktrees` | isolated workspace — architectural tier only |
| `subagent-driven-development` | one subagent per task |
| `dispatching-parallel-agents` | genuinely independent groups in parallel |
| `verification-before-completion` | invoked by `/idd:verify` before it claims anything |
| `requesting-code-review` | the independent review, behind `/idd:review` |

`requesting-code-review` is its own command. It used to be forbidden during apply
because the evaluator called it internally — a subagent paying for a subagent —
and then it was folded into verify. It sits outside both now: it is the
workflow's only outside opinion, worth running before a pull request or on a
change you did not write, and worth nothing as a ritual nobody reads.

When it does not run, `/idd:verify` records that no independent review ran. An
absence nobody writes down becomes an assumption.

If subagents are unavailable, `superpowers:executing-plans` is the fallback —
but it does **not** transitively activate TDD, so the gate must then be invoked
explicitly.

## Worked examples

### A new subsystem, from scratch

```
/idd:explore magic link authentication     → architectural
/idd:propose magic-link-auth               → proposal, specs, design, adr, tasks
/idd:apply magic-link-auth                 → worktree, TDD, one subagent per task
/idd:verify magic-link-auth
/idd:archive magic-link-auth               → openspec/specs/auth/spec.md is born
```

### A second change on the same project

*"limit magic link requests to 3 per hour"* — no new dependency, no
architectural decision. Skip explore:

```
/idd:propose rate-limit-magic-link         → bounded: proposal, specs, tasks
/idd:apply rate-limit-magic-link           → in place, no subagents
```

The proposal step reads the existing `openspec/specs/auth/spec.md`. That is
where the living spec starts paying for itself.

### A tactical fix

*"the token expires in 10 minutes, make it 15"* — no `idd` command at all. Do
it, commit it.

### An existing project

Run `openspec init --tools none` then `/idd:init`. **Do not retro-document.**
The living spec fills only from the changes you make from now on; that is what
makes adoption on an existing codebase bearable.

## Known constraints

**Worktrees follow the tier, not a setting.** They isolate a change from
concurrent work, and a bounded change has none to isolate from — so it works in
place. An architectural change with parallel groups uses one. Never on a
single-docroot stack such as DDEV, where the visual gate would probe the main
checkout while the edits live in the worktree.

**Projects with no test suite.** Set `runtime: false` to record the decision.
Leaving it on with no test commands would make `/idd:verify` block, so
`/idd:apply` refuses to start rather than let that surface at the end.
