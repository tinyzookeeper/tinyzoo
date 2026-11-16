/** Connecting to the host's database from the command line (`up`, `status`, `upgrade`). */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { allUpgradeSteps, collectPlugins, type MigrationSource, type SqlRunner, type UpgradeStep } from '../src/index'

/** `NUXT_CMS_DATABASE_URL` / `DATABASE_URL` from the environment, else from the host's `.env`. */
export function databaseUrl(cwd: string): string {
  const envFile = join(cwd, '.env')
  if (!process.env.DATABASE_URL && !process.env.NUXT_CMS_DATABASE_URL && existsSync(envFile)) {
    try { process.loadEnvFile(envFile) } catch { /* unreadable .env: reported below */ }
  }
  const url = process.env.NUXT_CMS_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('No database address: set DATABASE_URL (in the environment or the site\'s .env).')
  return url
}

/** Where the connection goes, without the credentials — safe to print. */
export function describeDatabase(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`
  }
  catch { return 'the database' }
}

/** The host's drizzle-kit migrations folder, read from disk. */
export function diskSource(cwd: string, dir = 'server/db/migrations'): MigrationSource {
  const root = resolve(cwd, dir)
  const journalFile = join(root, 'meta/_journal.json')
  if (!existsSync(journalFile)) throw new Error(`No migrations found (${journalFile}) — run \`tinyzoo generate\` first.`)
  return {
    journal: JSON.parse(readFileSync(journalFile, 'utf8')),
    readSql: async (tag) => readFileSync(join(root, `${tag}.sql`), 'utf8'),
  }
}

/** Connect, hand over a runner and a transaction helper, and always disconnect. */
export async function withDatabase<T>(
  url: string,
  fn: (db: { run: SqlRunner; transaction: <R>(f: (run: SqlRunner) => Promise<R>) => Promise<R> }) => Promise<T>,
): Promise<T> {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 10_000 })
  try {
    return await fn({
      run: async (text, params) => (await pool.query(text, params as any[])).rows,
      transaction: async (f) => {
        const client = await pool.connect()
        try {
          await client.query('begin')
          const out = await f(async (text, params) => (await client.query(text, params as any[])).rows)
          await client.query('commit')
          return out
        }
        catch (err) {
          await client.query('rollback').catch(() => {})
          throw err
        }
        finally {
          client.release()
        }
      },
    })
  }
  finally {
    await pool.end()
  }
}

/** A readable one-liner for an error thrown while talking to the database. */
export function errorText(err: unknown): string {
  const e = err as any
  const parts = [e?.message, e?.code && `(${e.code})`, ...(Array.isArray(e?.errors) ? e.errors.map((x: any) => x?.message) : [])].filter(Boolean)
  return parts.join(' ') || String(err)
}

/**
 * tinyzoo's upgrade steps plus those of the plugins registered in the site's
 * `cms.config.ts` (no config, or none with plugins: tinyzoo's alone).
 */
export async function siteUpgradeSteps(cwd: string): Promise<UpgradeStep[]> {
  const file = resolve(cwd, 'cms.config.ts')
  if (!existsSync(file)) return allUpgradeSteps([])
  return allUpgradeSteps(collectPlugins(await import(pathToFileURL(file).href)))
}
