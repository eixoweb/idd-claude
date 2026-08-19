---
name: propose
description: "Open an OpenSpec change at the right tier and generate its artifacts"
---

Open a change for the work described in the argument.

Pass `--auto` to run it without confirmations — see below for what that does
and, more importantly, what it does not.

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

**A rule that names a skill means invoke that skill.** `Must use grilling skill`
in an artifact's `<rules>` is not a suggestion to ask some questions — it is an
instruction to load `grilling` and follow the shape it defines: the design tree
worked in rounds, the whole settled frontier asked at once, each question
numbered with your recommended answer beneath it, and a stated end when the
frontier empties.

Satisfying it with the native questioning UI is a substitution, not a
translation. Rendering the options as choices loses the frontier ordering, the
recommended answer per question and the end condition — which is most of why the
skill is named in the first place. The same holds for every rule that names one:
`c4-diagrams` on the design, `architectural-decision-records` on the ADR,
`visual-verification` on the tasks.

If, while writing the proposal for a bounded change, one of the architectural
criteria turns out to apply, stop and tell the user to recreate the change
with the full schema. It is cheap now and expensive after `tasks.md` exists.

## `--auto`

The flag removes confirmations, not thinking. With it:

- **Do not stop between artifacts.** Write them all, then show what was
  produced. A checkpoint after each one buys no safety that reading the files
  afterwards does not — they are in the working tree either way, and `git diff`
  says more than a summary.
- When `grilling` empties its frontier, **proceed rather than asking whether to
  proceed.** The answers already given are the agreement; asking again
  re-litigates a decision the user has just spent a round making.
- Commit the change folder when the artifacts are written (see below), instead
  of leaving it to the user.

What `--auto` **never skips**:

- the **tier guard** — a change that should not be opened is not improved by
  being opened faster;
- **the interview itself**. `grilling` asks because the answers are not
  derivable; a flag that guessed them would be inventing the intent rather than
  capturing it. Comment its rule out of `config.yaml` if you want it gone — that
  is a project decision, not a per-run one;
- the bounded-turns-out-architectural stop, which cannot be automated away: the
  change has to be recreated under the other schema.

## Commit the change folder

```
git add openspec/changes/<id> && git commit -m "docs: propose <id>"
```

`openspec-git-discipline` asks for this before `/idd:apply` runs, and it is not
bookkeeping. `/idd:apply` and `/idd:verify` derive the change's **base ref** from
the commit that introduced its `.openspec.yaml`. Leave the folder uncommitted and
that derivation finds nothing, falls back to the repository's **root commit**,
and every diff downstream carries the entire history of the project.

Under `--auto`, do it yourself. Otherwise say it is the next step and let the
user commit.
