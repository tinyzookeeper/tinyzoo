/**
 * `tinyzoo upgrade`: after `pnpm up tinyzoo @tinyzoo/client` — check the site's versions
 * against what this tinyzoo wants, generate the migration (with the breaking-statement
 * guard), regenerate the typed client, and show what the database still has to apply.
 */
import { docsUrl } from '../src/docs'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { journalTags } from './generate'
import { checkVersions } from './versions'
import { status } from './status'

export interface UpgradeDeps {
  /** Emit schema.ts and generate the migration (with the guard). Returns an exit code. */
  generate: () => Promise<number>
  /** The site's migrations folder (default `server/db/migrations`), to tell whether `generate` wrote one. */
  migrationsDir?: string
}

/** Returns the process exit code. */
export async function upgrade(cwd: string, pkgDir: string, deps: UpgradeDeps): Promise<number> {
  const own = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  console.log(`tinyzoo ${own.version}\n`)

  console.log('1. Versions')
  const problems = checkVersions(cwd, own)
  if (!problems.length) console.log('   ✓ nuxt, @nuxt/ui, nuxt-auth-utils, drizzle-orm and zod fit this tinyzoo')
  for (const p of problems) {
    console.warn(`   ⚠ ${p.name}: ${p.installed ? `${p.installed} is installed` : 'not installed'}, tinyzoo ${own.version} wants ${p.wanted} — update it (\`pnpm up ${p.name}\`) before deploying`)
  }

  console.log('\n2. Schema and migration')
  const migrationsDir = deps.migrationsDir ?? join(cwd, 'server/db/migrations')
  const before = new Set(journalTags(migrationsDir))
  const code = await deps.generate()
  if (code !== 0) {
    console.error('\n✗ Stopped: fix the above and run `tinyzoo upgrade` again.')
    return code
  }

  const pkgPath = join(cwd, 'package.json')
  const hostScripts = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {} : {}
  if (hostScripts['cms:client']) {
    console.log('\n3. Typed client')
    try {
      execFileSync('pnpm', ['run', 'cms:client'], { cwd, stdio: 'inherit' })
    }
    catch {
      console.error('\n✗ `pnpm run cms:client` failed.')
      return 1
    }
  }

  console.log('\n4. Database')
  const statusCode = await status(cwd)
  if (statusCode === 2) console.log('   (Could not check the database from here. Run `tinyzoo status` where DATABASE_URL points at it.)')

  const added = journalTags(migrationsDir).filter((t) => !before.has(t))
  console.log(`\n${nextSteps(added)}\n  Details: ${docsUrl('upgrading')}`)
  return 0
}

/** What to do after `tinyzoo upgrade`: with a new migration, read and commit it; without one, there is none to read. */
export function nextSteps(added: string[]): string {
  const deploy = '3. Deploy. The app migrates itself at start (NUXT_CMS_MIGRATIONS_ON_START=true), or run `tinyzoo up` yourself.'
  if (!added.length) {
    return `Next:
  1. No new migration: this update changes nothing in your database schema (step 4 shows whether earlier migrations are still waiting).
  2. pnpm typecheck, then commit schema.ts and the typed client (if they changed) together with the package update.
  ${deploy}`
  }
  const files = added.map((t) => `server/db/migrations/${t}.sql`).join(', ')
  return `Next:
  1. Read the new migration (${files}): that is the change your database will get.
  2. pnpm typecheck, then commit the migration, schema.ts and the typed client together with the package update.
  ${deploy}`
}
