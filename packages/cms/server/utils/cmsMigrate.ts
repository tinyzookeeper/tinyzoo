/**
 * Migrations at start. Pushbase (and most container platforms) ship only the build
 * output, so the database must be migrated by the app itself when it boots.
 *
 * The host's drizzle-kit migrations folder is bundled into the server build as
 * server assets (see module.ts), and applied here with drizzle's own bookkeeping —
 * the same `drizzle.__drizzle_migrations` table, hashes and ordering as
 * `drizzle-kit migrate` — so either tool can take over from the other — plus the
 * package's upgrade steps (the data work a migration cannot express, see
 * src/upgrades.ts) in the same transaction. A Postgres advisory lock makes concurrent
 * replicas take turns; the second one finds nothing left to do. A migration older than
 * the newest applied one that was never applied stops the start with an error. Node only: a Worker may not do I/O while it starts (see the plugin).
 *
 * The database may not accept connections yet when the app boots (a freshly
 * provisioned one, a restart during maintenance): connection errors are retried for
 * about a minute and a half. If migrating still fails, the instance reports itself
 * dead (/api/health/live) and, in production, exits so the platform restarts it —
 * rather than staying up and answering 503 forever.
 */

import { allUpgradeSteps, DEFAULT_MODEL, modelMigrationsAsset, isConnectionError, runUpgrade, sqlWithParams, type MigrationJournal, type MigrationSource } from 'tinyzoo'
import { scrubError } from './cmsScrub'

// Per site: in multi-tenant mode every site has its own database to migrate, and one
// site's failure is that site's own (it answers 503; the others carry on).
const migration = cmsSiteScoped(() => ({ ready: Promise.resolve() as Promise<void>, state: 'idle' as 'idle' | 'running' | 'done' | 'failed' }))

/** Resolves once start-up migrations have finished (immediately when disabled). */
export function cmsMigrationsReady(): Promise<void> {
  return migration().ready
}
export function cmsMigrationState() {
  return migration().state
}

/** Start migrating from the bundled assets (called once by the Nitro plugin). */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 15_000, 15_000, 15_000, 15_000]
export function startCmsMigrations(): void {
  const mine = migration()
  mine.state = 'running'
  const ready = mine.ready = (async () => {
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
    mine.state = 'failed'
    if (cmsIsMultiTenant()) {
      // One site of many: it answers 503 until its migrations pass; the process stays up for the others.
      console.error(`[cms] site ${useCmsSite().id}: migrations failed — this site will not serve API requests`, scrubError(err))
      throw err
    }
    console.error('[cms] migrations failed — the app will not serve API requests', scrubError(err))
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' && typeof process.exit === 'function') {
      // Let the platform restart the instance (after the log line is written).
      setTimeout(() => process.exit(1), 100)
    }
    throw err
  })
  ready.catch(() => {}) // the failure is reported through health and API requests
}

async function migrateOnce(): Promise<void> {
  // Each site is migrated with the migrations of its own content model.
  const model = cmsSiteModel().name
  const assets = useStorage('assets:' + modelMigrationsAsset(model))
  const journal = await assets.getItem<MigrationJournal>('meta/_journal.json')
  if (!journal?.entries) throw new Error(model === DEFAULT_MODEL
    ? 'No bundled migrations (meta/_journal.json) — is cms.migrations.dir right?'
    : `No bundled migrations (meta/_journal.json) for the content model "${model}" — is its \`migrations\` folder in defineModels right?`)
  const source: MigrationSource = {
    journal,
    readSql: async (tag) => {
      const raw = await assets.getItemRaw(`${tag}.sql`)
      if (raw == null) throw new Error(`Bundled migration ${tag}.sql is missing${model === DEFAULT_MODEL ? '' : ` (content model "${model}")`}`)
      return typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array)
    },
  }
  const { db, reg } = useCms()
  // Upgrade steps (tinyzoo's and the plugins') run in the same transaction and lock.
  const result = await runUpgrade(source, (fn) => (db as any).transaction((tx: any) =>
    fn(async (text, params = []) => {
      const res: any = await tx.execute(sqlWithParams(text, params))
      return res.rows ?? res
    })), allUpgradeSteps(reg.plugins))
  const ranSteps = result.steps.filter((s) => s.ran).map((s) => s.id)
  if (ranSteps.length) console.info(`[cms] ran upgrade steps: ${ranSteps.join(', ')}`)
  // One line per site that changed; "up to date" for each of many sites would only be noise.
  if (!cmsIsMultiTenant()) console.info(result.migrations.length ? `[cms] applied migrations: ${result.migrations.join(', ')}` : '[cms] database is up to date')
  else if (result.migrations.length) console.info(`[cms] site ${useCmsSite().id}: applied migrations: ${result.migrations.join(', ')}`)
  migration().state = 'done'
}
