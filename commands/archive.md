---
name: "IDD: Archive"
description: "Fold the change's delta specs into the living specs and archive it"
---

Archive the change named in the argument.

**Guard:** read `verification.md` first. If it does not record a PASS for every
group, refuse and tell the user to run `/idd:verify`. This is a guardrail, not
a lock — `openspec archive` remains callable directly, and the schema cannot
prevent it, because archive is a CLI command and not a node of the artifact
graph.

Then run `openspec archive <id>`, which folds the delta specs into
`openspec/specs/` and moves the change under `openspec/changes/archive/`.

Report which capabilities the living specs gained or changed. That tree is now
the answer to "what does this system do today" — it is the reason the pipeline
exists.
