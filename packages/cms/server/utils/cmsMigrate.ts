import { sql } from '@my-cms/core'
/**
 * Migrations at start. Pushbase (and most container platforms) ship only the build
 * output, so the database must be migrated by the app itself when it boots.
 *
 * The host's drizzle-kit migrations folder is bundled into the server build as
 * server assets (see module.ts), and applied here with drizzle's own bookkeeping —
 * the same `drizzle.__drizzle_migrations` table, hashes and ordering as
 * `drizzle-kit migrate` — so either tool can take over from the other. Web Crypto
 * only, so it runs on Workers too. A Postgres advisory lock makes concurrent replicas
 * take turns; the second one finds nothing left to do.
 */

import { applyMigrations, type MigrationJournal, type MigrationSource } from '@my-cms/core'

let ready: Promise<void> = Promise.resolve()
let state: 'idle' | 'running' | 'done' | 'failed' = 'idle'

/** Resolves once start-up migrations have finished (immediately when disabled). */
export function cmsMigrationsReady(): Promise<void> {
  return ready
}
export function cmsMigrationState() {
  return state
}

/** Start migrating from the bundled assets (called once by the Nitro plugin). */
export function startCmsMigrations(): void {
  state = 'running'
  ready = (async () => {
    const assets = useStorage('assets:cms-migrations')
    const journal = await assets.getItem<MigrationJournal>('meta/_journal.json')
    if (!journal?.entries) throw new Error('No bundled migrations (meta/_journal.json) — is cms.migrations.dir right?')
    const source: MigrationSource = {
      journal,
      readSql: async (tag) => {
        const raw = await assets.getItemRaw(`${tag}.sql`)
        if (raw == null) throw new Error(`Bundled migration ${tag}.sql is missing`)
        return typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array)
      },
    }
    const { db } = useCms()
    const applied = await applyMigrations(source, (fn) => (db as any).transaction((tx: any) =>
      fn(async (text, params = []) => {
        const res: any = await tx.execute(sqlFrom(text, params))
        return res.rows ?? res
      })))
    console.info(applied.length ? `[cms] applied migrations: ${applied.join(', ')}` : '[cms] database is up to date')
    state = 'done'
  })().catch((err) => {
    state = 'failed'
    console.error('[cms] migrations failed — the app will not serve API requests', err)
    throw err
  })
  ready.catch(() => {}) // the failure is reported through health and API requests
}

/** Positional params ($1, $2…) → a drizzle sql chunk with bound values. */
function sqlFrom(text: string, params: unknown[]) {
  const parts = text.split(/\$\d+/)
  return sql.join(parts.map((p, i) => (i < params.length ? sql`${sql.raw(p)}${params[i]}` : sql.raw(p))), sql.raw(''))
}
