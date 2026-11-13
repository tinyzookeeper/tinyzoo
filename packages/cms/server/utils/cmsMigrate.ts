/**
 * Migrations at start. Pushbase (and most container platforms) ship only the build
 * output, so the database must be migrated by the app itself when it boots.
 *
 * The host's drizzle-kit migrations folder is bundled into the server build as
 * server assets (see module.ts), and applied here with drizzle's own bookkeeping —
 * the same `drizzle.__drizzle_migrations` table, hashes and ordering as
 * `drizzle-kit migrate` — so either tool can take over from the other. A Postgres
 * advisory lock makes concurrent replicas take turns; the second one finds nothing
 * left to do. Node only: a Worker may not do I/O while it starts (see the plugin).
 *
 * The database may not accept connections yet when the app boots (a freshly
 * provisioned one, a restart during maintenance): connection errors are retried for
 * about a minute and a half. If migrating still fails, the instance reports itself
 * dead (/api/health/live) and, in production, exits so the platform restarts it —
 * rather than staying up and answering 503 forever.
 */

import { applyMigrations, isConnectionError, sqlWithParams, type MigrationJournal, type MigrationSource } from 'tinyzoo'

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
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 15_000, 15_000, 15_000, 15_000]
export function startCmsMigrations(): void {
  state = 'running'
  ready = (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await migrateOnce()
      }
      catch (err) {
        if (!isConnectionError(err) || attempt >= RETRY_DELAYS_MS.length) throw err
        const delayMs = RETRY_DELAYS_MS[attempt]!
        console.warn('[cms] database not reachable yet, retrying migrations in', delayMs, 'ms')
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  })().catch((err) => {
    state = 'failed'
    console.error('[cms] migrations failed — the app will not serve API requests', err)
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' && typeof process.exit === 'function') {
      // Let the platform restart the instance (after the log line is written).
      setTimeout(() => process.exit(1), 100)
    }
    throw err
  })
  ready.catch(() => {}) // the failure is reported through health and API requests
}

async function migrateOnce(): Promise<void> {
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
      const res: any = await tx.execute(sqlWithParams(text, params))
      return res.rows ?? res
    })))
  console.info(applied.length ? `[cms] applied migrations: ${applied.join(', ')}` : '[cms] database is up to date')
  state = 'done'
}
