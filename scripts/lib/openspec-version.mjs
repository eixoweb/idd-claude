import { execFileSync } from 'node:child_process'

export const MINIMUM_OPENSPEC = '1.9.0'

export function parseVersion(output) {
  const match = String(output).trim().match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function isAtLeast(version, minimum) {
  const a = parseVersion(version)
  const b = parseVersion(minimum)
  if (!a || !b) return false
  if (a.major !== b.major) return a.major > b.major
  if (a.minor !== b.minor) return a.minor > b.minor
  return a.patch >= b.patch
}

const defaultRun = () => execFileSync('openspec', ['--version'], { encoding: 'utf8' })

export function detectOpenspec(run = defaultRun) {
  let raw
  try {
    raw = run()
  } catch {
    return { installed: false, version: null, satisfies: false }
  }
  const parsed = parseVersion(raw)
  if (!parsed) return { installed: true, version: null, satisfies: false }
  const version = `${parsed.major}.${parsed.minor}.${parsed.patch}`
  return { installed: true, version, satisfies: isAtLeast(version, MINIMUM_OPENSPEC) }
}
