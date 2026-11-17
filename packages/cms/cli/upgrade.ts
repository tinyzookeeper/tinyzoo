/**
 * `tinyzoo upgrade`: after `pnpm up tinyzoo @tinyzoo/client` — check the site's versions
 * against what this tinyzoo wants, generate the migration (with the breaking-statement
 * guard), regenerate the typed client, and show what the database still has to apply.
 */
import { docsUrl } from '../src/docs'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkVersions } from './versions'
import { status } from './status'

export interface UpgradeDeps {
  /** Emit schema.ts and generate the migration (with the guard). Returns an exit code. */
  generate: () => Promise<number>
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

  console.log(`\nNext:
  1. Read the new migration in server/db/migrations — that is the change your database will get.
  2. pnpm typecheck, then commit the migration, schema.ts and the typed client together with the package update.
  3. Deploy. The app migrates itself at start (NUXT_CMS_MIGRATIONS_ON_START=true), or run \`tinyzoo up\` yourself.
  Details: ${docsUrl('upgrading')}`)
  return 0
}
