/** Version checks for `tinyzoo upgrade`: does the site's own nuxt, @nuxt/ui, nuxt-auth-utils, drizzle-orm and zod fit? */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

export const CHECKED_PACKAGES = ['nuxt', '@nuxt/ui', 'nuxt-auth-utils', 'drizzle-orm', 'zod'] as const

const parseVersion = (v: string): [number, number, number] | null => {
  const m = /^[v=\s]*(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/.exec(v)
  return m ? [Number(m[1]), m[2] && /^\d+$/.test(m[2]) ? Number(m[2]) : 0, m[3] && /^\d+$/.test(m[3]) ? Number(m[3]) : 0] : null
}
const cmp = (a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!

/** The common range forms: `^1.2.3`, `~1.2.3`, `>=1.2.3`, `1.2.3`, `1.x`, `*`, joined by `||`. */
export function satisfiesRange(version: string, range: string): boolean {
  const v = parseVersion(version)
  if (!v) return false
  return range.split('||').some((alt) => {
    const r = alt.trim()
    if (!r || r === '*' || r === 'x') return true
    const [, op = '', rest = ''] = /^([\^~]|>=|>|<=|<|=)?\s*(.*)$/.exec(r) ?? []
    const base = parseVersion(rest)
    if (!base) return false
    if (op === '>=') return cmp(v, base) >= 0
    if (op === '>') return cmp(v, base) > 0
    if (op === '<=') return cmp(v, base) <= 0
    if (op === '<') return cmp(v, base) < 0
    if (op === '^') {
      // Compatible with the leftmost non-zero part: ^1.2.3 → <2.0.0, ^0.44.0 → <0.45.0, ^0.0.3 → <0.0.4.
      const upper = base[0] ? [base[0] + 1, 0, 0] : base[1] ? [0, base[1] + 1, 0] : [0, 0, base[2]! + 1]
      return cmp(v, base) >= 0 && cmp(v, upper) < 0
    }
    if (op === '~') return cmp(v, base) >= 0 && cmp(v, [base[0]!, base[1]! + 1, 0]) < 0
    // Exact, or a partial like "1.x" / "1.2".
    const parts = rest.split('.')
    return parts.every((p, i) => p === 'x' || p === '*' || Number(p) === v[i])
  })
}

/** The version of a package as the site has it installed, or null. Walks up for hoisted installs. */
export function installedVersion(cwd: string, name: string): string | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const file = join(dir, 'node_modules', name, 'package.json')
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).version ?? null
    if (dir === parse(dir).root) return null
  }
}

export interface VersionProblem { name: string; installed: string | null; wanted: string }

/** Installed versions that do not fit what tinyzoo asks for (not installed counts too). */
export function checkVersions(cwd: string, tinyzooPackage: { peerDependencies?: Record<string, string>; dependencies?: Record<string, string> }): VersionProblem[] {
  const problems: VersionProblem[] = []
  for (const name of CHECKED_PACKAGES) {
    const wanted = tinyzooPackage.peerDependencies?.[name] ?? tinyzooPackage.dependencies?.[name]
    if (!wanted) continue
    const installed = installedVersion(cwd, name)
    if (!installed || !satisfiesRange(installed, wanted)) problems.push({ name, installed, wanted })
  }
  return problems
}
