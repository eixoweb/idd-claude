---
name: verify
description: "Check that the implementation is complete and its verification is green"
---

Verify the change named in the argument.

1. Run `openspec validate --all --json` and report any structural failure.
2. Read `tasks.md`: **every checkbox must be ticked**. List any that are not
   and stop — an unfinished change is not verifiable.
3. Read `verification.md`. Every group must have reached PASS. Report any
   group that ended in BLOCK or hit the iteration cap.
4. Confirm the working tree is clean and the change's commits exist.

Report PASS, PASS WITH WARNINGS, or FAIL, and write the outcome into
`verification.md`. On FAIL, name the artifact to go back to.
