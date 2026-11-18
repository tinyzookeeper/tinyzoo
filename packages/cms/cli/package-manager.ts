/**
 * The site's package manager, for the commands the CLI runs and prints (`tinyzoo init
 * --package-manager npm|yarn|bun` makes sites that do not use pnpm). Told by the lockfile
 * next to the site (or above it, in a monorepo), then by the `packageManager` field of its
 * package.json, then by the package manager that started the command; pnpm otherwise.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
]
const NAME = /^(pnpm|npm|yarn|bun)(?:@|\/|$)/

export function sitePackageManager(cwd: string, userAgent = process.env.npm_config_user_agent): PackageManager {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const found = LOCKFILES.find(([file]) => existsSync(join(dir, file)))
    if (found) return found[1]
    if (dir === parse(dir).root) break
  }
  try {
    const field = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).packageManager
    const name = NAME.exec(String(field ?? ''))?.[1]
    if (name) return name as PackageManager
  }
  catch { /* no package.json: the user agent decides */ }
  return (NAME.exec(userAgent ?? '')?.[1] as PackageManager | undefined) ?? 'pnpm'
}

/** The command that puts `name` at a version in `range` into the site (as text, to print). */
export function addCommand(pm: PackageManager, name: string, range: string, dev = false): string {
  const add = pm === 'npm' ? 'npm install' : `${pm} add`
  return `${add}${dev ? ' -D' : ''} "${name}@${range}"`
}

/** How the package manager runs a bin the site has installed: `pnpm exec drizzle-kit generate` and the like. */
export function execArgs(pm: PackageManager, bin: string, args: string[]): [string, string[]] {
  if (pm === 'npm') return ['npm', ['exec', '--', bin, ...args]]
  if (pm === 'yarn') return ['yarn', [bin, ...args]]
  if (pm === 'bun') return ['bun', ['x', bin, ...args]]
  return ['pnpm', ['exec', bin, ...args]]
}
