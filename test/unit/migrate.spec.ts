import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { PgDialect } from 'drizzle-orm/pg-core'
import { applyMigrations, isConnectionError, sqlWithParams, type MigrationSource } from 'tinyzoo'
import { testDatabaseUrl } from '../setup/database'

// The start-up migrator must keep exactly drizzle-kit's bookkeeping, so either can
// take over from the other. Runs against its own throwaway database.
const dir = join(import.meta.dirname, '../../playground/server/db/migrations')
const source: MigrationSource = {
  journal: JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8')),
  readSql: async (tag) => readFileSync(join(dir, `${tag}.sql`), 'utf8'),
}
const url = new URL(testDatabaseUrl())
url.pathname = '/cms_migrate_test'
let pool: pg.Pool

async function inTransaction<T>(fn: (run: (text: string, params?: unknown[]) => Promise<any[]>) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const out = await fn(async (text, params) => (await client.query(text, params as any[])).rows)
    await client.query('commit')
    return out
  }
  catch (err) {
    await client.query('rollback')
    throw err
  }
  finally {
    client.release()
  }
}

beforeAll(async () => {
  const admin = new URL(url); admin.pathname = '/postgres'
  const c = new pg.Client({ connectionString: admin.toString() })
  await c.connect()
  await c.query('drop database if exists cms_migrate_test')
  await c.query('create database cms_migrate_test')
  await c.end()
  pool = new pg.Pool({ connectionString: url.toString() })
})
afterAll(() => pool?.end())

describe('start-up migrations', () => {
  it('migrates an empty database and records exactly what drizzle-kit would', async () => {
    const applied = await applyMigrations(source, inTransaction)
    expect(applied).toEqual(source.journal.entries.map((e) => e.tag))
    const { rows } = await pool.query('select hash, created_at from drizzle.__drizzle_migrations order by created_at')
    const expected = readMigrationFiles({ migrationsFolder: dir })
    expect(rows.map((r) => r.hash)).toEqual(expected.map((m) => m.hash))
    expect(rows.map((r) => Number(r.created_at))).toEqual(expected.map((m) => m.folderMillis))
    const { rowCount } = await pool.query(`select 1 from information_schema.tables where table_name in ('cms_users', 'post_locales', 'redirect')`)
    expect(rowCount).toBe(3)
  })

  it('is a no-op the second time, and drizzle-kit agrees nothing is left', async () => {
    expect(await applyMigrations(source, inTransaction)).toEqual([])
    await migrate(drizzle(pool), { migrationsFolder: dir })
    const { rowCount } = await pool.query('select 1 from drizzle.__drizzle_migrations')
    expect(rowCount).toBe(source.journal.entries.length)
  })

  it('lets concurrent starts take turns (advisory lock): one applies, the other finds nothing', async () => {
    await pool.query('drop schema public cascade; create schema public; drop schema drizzle cascade')
    const [a, b] = await Promise.all([applyMigrations(source, inTransaction), applyMigrations(source, inTransaction)])
    expect([a.length, b.length].sort()).toEqual([0, source.journal.entries.length])
  })
})

describe('sqlWithParams', () => {
  const render = (text: string, params?: unknown[]) => new PgDialect().sqlToQuery(sqlWithParams(text, params))

  it('leaves migration SQL alone, $ signs included', () => {
    const text = `ALTER TABLE "p" ADD COLUMN "price" text DEFAULT 'costs $5';\nCREATE FUNCTION f(int) RETURNS int AS 'select $1' LANGUAGE sql;`
    expect(render(text)).toMatchObject({ sql: text, params: [] })
  })

  it('binds positional params by number, in any order', () => {
    expect(render('select $2, $1, $2', ['a', 'b'])).toMatchObject({ sql: 'select $1, $2, $3', params: ['b', 'a', 'b'] })
  })
})

describe('isConnectionError', () => {
  it('recognises an unreachable database, also wrapped and aggregated', () => {
    expect(isConnectionError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(true)
    expect(isConnectionError(new Error('wrapped', { cause: { code: '57P03' } }))).toBe(true)
    expect(isConnectionError(Object.assign(new AggregateError([{ code: 'ECONNREFUSED' }]), {}))).toBe(true)
  })
  it('does not retry a failing statement', () => {
    expect(isConnectionError(Object.assign(new Error('syntax'), { code: '42601' }))).toBe(false)
  })
})
