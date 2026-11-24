import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../db/schema'

export { schema }
export type Db = NodePgDatabase<typeof schema>

let db: Db | undefined
let pool: pg.Pool | undefined

/** The cloud's database address: NUXT_DATABASE_URL, or DATABASE_URL. */
export function databaseUrl(): string {
  const url = String(useRuntimeConfig().databaseUrl || process.env.DATABASE_URL || '')
  if (!url) throw new Error('[cloud] set NUXT_DATABASE_URL (or DATABASE_URL)')
  return url
}

/** The database (one pool per process). */
export function useDb(): Db {
  if (db) return db
  pool = new pg.Pool({ connectionString: databaseUrl(), max: 10 })
  db = drizzle(pool, { schema })
  return db
}

/** The pool under useDb(), for a connection of its own (advisory locks, CREATE DATABASE). */
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
