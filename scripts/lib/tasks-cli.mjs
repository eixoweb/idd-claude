#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseTasks } from './tasks.mjs'

const [path] = process.argv.slice(2)
if (!path) {
  console.error('usage: tasks-cli.mjs <tasks.md>')
  process.exit(2)
}
console.log(JSON.stringify(parseTasks(readFileSync(path, 'utf8')), null, 2))
