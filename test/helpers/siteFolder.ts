import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const playground = join(import.meta.dirname, '../../playground')

/**
 * A site folder whose only database setting is its `.env`, as a developer's is: it
 * re-exports the playground's content model, so the command under test loads a real config.
 * Run commands with `env` WITHOUT DATABASE_URL (see `envWithout`).
 */
export function siteFolderWithEnvFile(databaseUrl: string): { dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'cms-site-'))
  writeFileSync(join(dir, 'cms.config.ts'), `export * from ${JSON.stringify(join(playground, 'cms.config.ts'))}\n`)
  writeFileSync(join(dir, '.env'), `DATABASE_URL=${databaseUrl}\n`)
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) }
}

/** The process environment without the database variables, so a command has to find them in `.env`. */
export function envWithout(...names: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const n of ['DATABASE_URL', 'NUXT_CMS_DATABASE_URL', ...names]) delete env[n]
  return env
}
