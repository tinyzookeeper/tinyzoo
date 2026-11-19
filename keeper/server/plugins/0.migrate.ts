import { createHash } from 'node:crypto'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Keeper migrates its own database when it starts, with drizzle's bookkeeping (so
// `drizzle-kit migrate` can take over). The SQL ships inside the server build as server
// assets (nuxt.config.ts), so a deployment needs nothing but its .output. The files are
// read from there in memory: hosts like Pushbase run the app on a read-only filesystem.
// NUXT_MIGRATIONS_DIR points at a folder to use instead.

interface MigrationMeta { sql: string[]; bps: boolean; folderMillis: number; hash: string }

/** What drizzle's readMigrationFiles makes of a migrations folder, from the bundled assets. */
async function bundledMigrations(): Promise<MigrationMeta[] | null> {
  const assets = useStorage('assets:keeper-migrations')
  const journal = await assets.getItem<{ entries: { tag: string; when: number; breakpoints: boolean }[] }>('meta:_journal.json')
  if (!journal?.entries) return null
  const out: MigrationMeta[] = []
  for (const entry of journal.entries) {
    const raw = await assets.getItemRaw(`${entry.tag}.sql`)
    if (raw == null) throw new Error(`migration ${entry.tag}.sql is missing from the build`)
    const query = typeof raw === 'string' ? raw : Buffer.from(raw as ArrayBuffer).toString('utf8')
    out.push({ sql: query.split('--> statement-breakpoint'), bps: entry.breakpoints, folderMillis: entry.when, hash: createHash('sha256').update(query).digest('hex') })
  }
  return out
}

export default defineNitroPlugin(() => {
  const configured = String(useRuntimeConfig().migrationsDir || '')
  setMigrations((async () => {
    const db = useDb()
    if (configured) {
      await migrate(db, { migrationsFolder: configured })
    }
    else {
      const migrations = await bundledMigrations()
      if (!migrations) {
        console.warn('[keeper] no migrations bundled; set NUXT_MIGRATIONS_DIR')
        return
      }
      // What drizzle's migrate() does after reading the folder.
      await (db as any).dialect.migrate(migrations, (db as any).session, {})
    }
    console.info('[keeper] database is up to date')
  })().catch((err) => {
    console.error('[keeper] migrations failed', err?.message ?? err)
    if (process.env.NODE_ENV === 'production') setTimeout(() => process.exit(1), 100)
    throw err
  }))
})
