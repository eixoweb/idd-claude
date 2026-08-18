import { execFileSync } from 'node:child_process'
import { join, relative } from 'node:path'

// The change's own artifacts are not code under review. Carrying their diff
// inflates every consumer and dilutes what is being looked at.
const PAPERWORK = /^openspec\//

export function splitDiffFiles(files) {
  const all = (files ?? []).map(String)
  return {
    code: all.filter((f) => !PAPERWORK.test(f)),
    artifacts: all.filter((f) => PAPERWORK.test(f)),
  }
}

/**
 * The change's code diff, with the base derived rather than guessed: the commit
 * that introduced the change folder, minus one. Everything downstream — the TDD
 * guards, the verification report — works from this one derivation, so there is
 * no second opinion about what the change contains.
 */
export function changeDiff(changeId, projectRoot = process.cwd()) {
  const changeDir = join(projectRoot, 'openspec', 'changes', changeId)
  const git = (...args) =>
    execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

  const introduced = git(
    'log',
    '--diff-filter=A',
    '--format=%H',
    '--',
    relative(projectRoot, join(changeDir, '.openspec.yaml')),
  )
    .trim()
    .split('\n')
    .filter(Boolean)
    .pop()

  const base = introduced
    ? git('rev-parse', `${introduced}^`).trim()
    : git('rev-list', '--max-parents=0', 'HEAD').trim()
  const head = git('rev-parse', 'HEAD').trim()

  const changed = git('diff', '--name-only', `${base}..${head}`).trim().split('\n').filter(Boolean)
  const { code, artifacts } = splitDiffFiles(changed)

  return {
    base,
    head,
    changedFiles: code,
    artifactFiles: artifacts,
    diff: code.length > 0 ? git('diff', `${base}..${head}`, '--', ...code) : '',
  }
}
