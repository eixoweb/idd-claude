#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { changeDiff } from './lib/change-diff.mjs'
import { guardRefactor } from './lib/refactor-guard.mjs'
import { parseTasks } from './lib/tasks.mjs'

const [changeId, projectRoot = process.cwd()] = process.argv.slice(2)
if (!changeId) {
  console.error('usage: refactor-guard-cli.mjs <changeId> [projectRoot]')
  process.exit(2)
}

const tasksPath = join(projectRoot, 'openspec', 'changes', changeId, 'tasks.md')
const groups = parseTasks(readFileSync(tasksPath, 'utf8'))
const { diff } = changeDiff(changeId, projectRoot)

const result = guardRefactor({ groups, diff })
console.log(JSON.stringify(result, null, 2))

// Non-zero on a block, like the preflight: the caller stops on the exit code
// rather than on its reading of the output.
process.exit(result.blocked ? 1 : 0)
