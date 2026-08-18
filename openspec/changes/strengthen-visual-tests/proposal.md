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

No production code changes: the behaviour is already correct. What is missing
is anything that would notice if it stopped being.

## Capabilities

- visual-assertions

## Impact

`tests/visual-parse.test.mjs` and `tests/visual-evaluate.test.mjs` only.
