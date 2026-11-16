// Facts about a checkout that the upgrade check reads: which versions its lockfile resolved
// for the starter (so a site installs what that ref was tested with), the workspace's
// overrides, and which release tag is the newest.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'


/** `{ name: exact version }` of one importer of a pnpm-lock.yaml (lockfile v9), peer suffixes removed. */
export function lockfileVersions(refRoot, importer) {
  const file = join(refRoot, 'pnpm-lock.yaml')
  if (!existsSync(file)) return {}
  const lines = readFileSync(file, 'utf8').split('\n')
  const start = lines.findIndex((l) => l === `  ${importer}:`)
  if (start < 0) return {}
  const out = {}
  let name = null
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) || /^ {2}\S/.test(line)) break
    const n = /^ {6}'?([^':]+)'?:\s*$/.exec(line)
    if (n) { name = n[1]; continue }
    const v = /^ {8}version: (\S+)/.exec(line)
    if (v && name && !v[1].startsWith('link:')) out[name] = v[1].replace(/\(.*$/, '')
  }
  return out
}

/** The `overrides:` of pnpm-workspace.yaml (one copy of the editor stack), as a site needs them too. */
export function workspaceOverrides(refRoot) {
  const file = join(refRoot, 'pnpm-workspace.yaml')
  if (!existsSync(file)) return {}
  const out = {}
  let inside = false
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (/^overrides:\s*$/.test(line)) { inside = true; continue }
    if (inside && /^\S/.test(line)) break
    const m = inside && /^\s+'?([^':]+)'?:\s*(\S+)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^'|'$/g, '')
  }
  return out
}


/**
 * The newest release tag by version. Tags are `v0.2.0`, or what Changesets writes in a
 * monorepo (`tinyzoo@0.2.0`); a pre-release (`v0.3.0-rc.1`) sorts below its release.
 */
export function newestTag(tags) {
  const parse = (t) => {
    const [core, pre] = t.replace(/^(tinyzoo@|v)/, '').split('-', 2)
    return { core: core.split('.').map(Number), pre }
  }
  const compare = (a, b) => {
    const x = parse(a); const y = parse(b)
    for (let i = 0; i < 3; i++) if ((x.core[i] ?? 0) !== (y.core[i] ?? 0)) return (y.core[i] ?? 0) - (x.core[i] ?? 0)
    if (!x.pre !== !y.pre) return x.pre ? 1 : -1
    return (y.pre ?? '').localeCompare(x.pre ?? '')
  }
  return [...tags].sort(compare)[0]
}
