## Why

`scripts/lib/visual.mjs` scores 71.4% on mutation, the lowest in the codebase,
with 46 surviving mutants. Twenty-two of them relax one of the four regexes:
nothing feeds the parser malformed input, so loosening an anchor or a separator
width goes unnoticed. The module decides whether a change's rendering is
correct — its own tests being the weakest in the project is the wrong place for
that weakness to sit.

## What Changes

- Tests pinning what the assertion parser rejects, not only what it accepts.
- Tests pinning the content of failure messages.
- Tests pinning the probe built for each assertion kind.

The visual-assertion behaviour itself is already correct; what is missing is
anything that would notice if it stopped being.

**Bundled fix, discovered while running this change.** The mutation dimension
could not report a score at all: `mutation-cli.mjs` passed Stryker a `--since`
flag that does not exist, so every scoped run returned UNKNOWN. Since this
change's own acceptance criterion is a mutation score, the fix could not be
deferred. It carries a second correction: scoping is now decided by whether the
diff touches tests, because a changed test's coverage is not derivable from its
path, and the earlier rule silently skipped the module a change set out to
measure.

## Capabilities

- visual-assertions
- mutation-scoping

## Impact

- `tests/visual-parse.test.mjs`, `tests/visual-evaluate.test.mjs` — the tests
  this change exists to add.
- `scripts/lib/mutation.mjs`, `scripts/mutation-cli.mjs`,
  `tests/mutation.test.mjs` — the bundled fix.
