import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

export const repoRoot = join(import.meta.dirname, '..', '..')
export const playgroundDir = join(repoRoot, 'playground')

/** `DATABASE_URL` from the environment, else from playground/.env, else the compose default. */
function devDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envFile = join(playgroundDir, '.env')
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))
    if (line) return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
  }
  return 'postgres://cms:cms@localhost:5434/cms'
}

/**
 * The suite's own database: `<dev db>_test` on the same server (or TEST_DATABASE_URL).
 * Never the development database — the API specs truncate every table they touch.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  const url = new URL(devDatabaseUrl())
  const name = url.pathname.replace(/^\//, '') || 'cms'
  url.pathname = `/${name.endsWith('_test') ? name : `${name}_test`}`
  return url.toString()
}

/** Create the test database if missing, wipe it, and apply the playground's migrations. */
export async function prepareTestDatabase(url: string): Promise<void> {
  const target = new URL(url)
  const dbName = target.pathname.replace(/^\//, '')
  if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error(`Refusing odd test database name: ${dbName}`)
  if (!dbName.endsWith('_test')) throw new Error(`Test database must end in _test, got ${dbName}`)

  const admin = new URL(url)
  admin.pathname = '/postgres'
  const adminClient = new pg.Client({ connectionString: admin.toString() })
  await adminClient.connect()
  try {
    const { rowCount } = await adminClient.query('select 1 from pg_database where datname = $1', [dbName])
    if (!rowCount) await adminClient.query(`create database "${dbName}"`)
  }
  finally {
    await adminClient.end()
  }

  const pool = new pg.Pool({ connectionString: url })
  try {
    // Start every run from nothing: the schema is whatever the migrations say it is.
    await pool.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;')
    await migrate(drizzle(pool), { migrationsFolder: join(playgroundDir, 'server/db/migrations') })
  }
  finally {
    await pool.end()
  }
}
