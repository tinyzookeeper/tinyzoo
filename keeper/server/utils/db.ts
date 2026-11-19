import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../db/schema'

export { schema }
export type Db = NodePgDatabase<typeof schema>

let db: Db | undefined
let pool: pg.Pool | undefined

/** The database (one pool per process): NUXT_DATABASE_URL, or DATABASE_URL. */
export function useDb(): Db {
  if (db) return db
  const url = String(useRuntimeConfig().databaseUrl || process.env.DATABASE_URL || '')
  if (!url) throw new Error('[keeper] set NUXT_DATABASE_URL (or DATABASE_URL)')
  pool = new pg.Pool({ connectionString: url, max: 10 })
  db = drizzle(pool, { schema })
  return db
}

/** The pool under useDb(), for a connection of its own (advisory locks). */
export function usePool(): pg.Pool {
  useDb()
  return pool!
}

let migrated: Promise<void> = Promise.resolve()
/** Resolves once start-up migrations are done (server/plugins/0.migrate.ts). */
export const migrationsReady = (): Promise<void> => migrated
export function setMigrations(p: Promise<void>): void {
  migrated = p
  p.catch(() => {})
}
