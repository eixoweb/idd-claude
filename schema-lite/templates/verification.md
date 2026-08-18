# Verification Report

**Change**: `<change-name>`
**Outcome**: `<PASS | PASS WITH WARNINGS | FAIL | BLOCKED>`

## Measured

Verbatim from `verify-cli.mjs`.

| Dimension | Status | Detail |
| --------- | ------ | ------ |
| `runtime` | — | — |
| `visual` | — | — |
| `mutation` | — | `<score>` against threshold `<n>` |
| `acceptance` | — | — |

<!-- A dimension the config disables does not appear. One that is enabled but
     could not be measured is UNKNOWN, and the outcome is BLOCKED. -->

## Judged

**Completeness** — every SHALL has an implementation, named by file and line.

**Correctness** — what was built matches the requirement, every scenario covered.

**Coherence** — the change follows the design and the patterns already there.

**Code review** — findings from `superpowers:requesting-code-review`.

## Findings

- <dimension>: <finding>

## Warnings

<!-- Recorded even when the outcome is PASS. A warning nobody wrote down was not
     a warning — the visual coverage warning belongs here. -->

- <none, or the warning>
