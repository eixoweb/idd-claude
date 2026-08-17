---
name: "IDD: Init"
description: "Install the idd-claude OpenSpec schema into this project and write its config"
---

Set up this project for the idd-claude workflow.

1. Run the promotion script from the repository root:

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/promote.mjs" .`

   If it exits non-zero, report its message verbatim and stop. Do not attempt
   to install or upgrade OpenSpec yourself — tell the user the command to run.

2. Read `openspec/config.yaml`. If `project.dev_stack_command` or
   `project.test_commands` are empty, ask the user for them one at a time and
   fill them in. These are required before `/idd:apply` can score the runtime
   and visual dimensions.

3. Confirm `openspec schemas` lists `idd-claude`, then report:
   - where the schema was installed,
   - whether the config was created or left untouched,
   - that `verification.spec_as_source` and `verification.mutation` are off by
     default, and how to enable each.

Never edit files under `openspec/schemas/idd-claude/` in a target project:
they are a copy, and the next promotion overwrites them.
