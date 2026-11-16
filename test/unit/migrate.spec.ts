import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  applyMigrations, classifyMigrations, CORE_UPGRADE_STEPS, inspectMigrations, isConnectionError, MigrationOrderError, runUpgrade, sqlWithParams,
  type MigrationSource, type SqlRunner, type UpgradeStep,
} from 'tinyzoo'
import { testDatabaseUrl } from '../setup/database'

// The start-up migrator must keep exactly drizzle-kit's bookkeeping, so either can
// take over from the other. Runs against its own throwaway database.
const dir = join(import.meta.dirname, '../../playground/server/db/migrations')
const source: MigrationSource = {
  journal: JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8')),
  readSql: async (tag) => readFileSync(join(dir, `${tag}.sql`), 'utf8'),
}
// Next to the suite's own database, never a name another checkout's run would also use.
const url = new URL(testDatabaseUrl())
const dbName = `${url.pathname.replace(/^\//, '')}_migrate`
url.pathname = `/${dbName}`
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
  await c.query(`drop database if exists "${dbName}"`)
  await c.query(`create database "${dbName}"`)
  await c.end()
  pool = new pg.Pool({ connectionString: url.toString() })
})
afterAll(() => pool?.end())

describe('start-up migrations', () => {
  it('migrates an empty database and records exactly what drizzle-kit would', async () => {
    const applied = await applyMigrations(source, inTransaction, CORE_UPGRADE_STEPS)
    expect(applied).toEqual(source.journal.entries.map((e) => e.tag))
    const { rows } = await pool.query('select hash, created_at from drizzle.__drizzle_migrations order by created_at')
    const expected = readMigrationFiles({ migrationsFolder: dir })
    expect(rows.map((r) => r.hash)).toEqual(expected.map((m) => m.hash))
    expect(rows.map((r) => Number(r.created_at))).toEqual(expected.map((m) => m.folderMillis))
    const { rowCount } = await pool.query(`select 1 from information_schema.tables where table_name in ('cms_users', 'post_locales', 'redirect')`)
    expect(rowCount).toBe(3)
  })

  it('is a no-op the second time, and drizzle-kit agrees nothing is left', async () => {
    expect(await applyMigrations(source, inTransaction, CORE_UPGRADE_STEPS)).toEqual([])
    await migrate(drizzle(pool), { migrationsFolder: dir })
    const { rowCount } = await pool.query('select 1 from drizzle.__drizzle_migrations')
    expect(rowCount).toBe(source.journal.entries.length)
  })

  it('lets concurrent starts take turns (advisory lock): one applies, the other finds nothing', async () => {
    await pool.query('drop schema public cascade; create schema public; drop schema drizzle cascade')
    const [a, b] = await Promise.all([applyMigrations(source, inTransaction, CORE_UPGRADE_STEPS), applyMigrations(source, inTransaction, CORE_UPGRADE_STEPS)])
    expect([a.length, b.length].sort()).toEqual([0, source.journal.entries.length])
  })
})

const reset = () => pool.query('drop schema public cascade; create schema public; drop schema if exists drizzle cascade')

/** A tiny in-memory journal: [when, tag, sql]. */
const mini = (...rows: [number, string, string][]): MigrationSource => ({
  journal: { entries: rows.map(([when, tag], idx) => ({ idx, when, tag })) },
  readSql: async (tag) => rows.find((r) => r[1] === tag)![2],
})
const A = [1000, '0000_a', 'CREATE TABLE "t_a" ("id" int);'] as [number, string, string]
const B = [2000, '0001_b', 'CREATE TABLE "t_b" ("id" int);--> statement-breakpoint\nCREATE INDEX "t_b_idx" ON "t_b" ("id");'] as [number, string, string]
const exists = async (run: SqlRunner, table: string) => (await run('select to_regclass($1) is not null as e', [table]))[0].e as boolean
const appliedSteps = async () => (await pool.query('select id from cms_upgrades order by id')).rows.map((r) => r.id)

describe('which migrations are pending, which were skipped', () => {
  it('treats what is newer than everything applied as pending, in journal order', () => {
    const entries = [{ idx: 0, when: 10 }, { idx: 1, when: 20 }, { idx: 2, when: 30 }]
    expect(classifyMigrations(entries, [10, 20])).toMatchObject({ applied: [entries[0], entries[1]], pending: [entries[2]], outOfOrder: [], unknown: 0 })
    expect(classifyMigrations(entries, []).pending).toEqual(entries)
  })

  it('flags a never-applied migration older than the newest applied one (two branches, one skipped)', () => {
    const entries = [{ idx: 0, when: 10 }, { idx: 1, when: 15 }, { idx: 2, when: 20 }]
    expect(classifyMigrations(entries, [10, 20])).toMatchObject({ outOfOrder: [entries[1]], pending: [] })
  })

  it('counts applied migrations the journal does not know (a newer version ran here)', () => {
    expect(classifyMigrations([{ idx: 0, when: 10 }], [10, 99]).unknown).toBe(1)
  })
})

describe('order guard', () => {
  it('stops with the file and the fix instead of skipping an unapplied older migration', async () => {
    await reset()
    await applyMigrations(mini(A, B), inTransaction, [])
    const withLate = mini(A, [1500, '0002_late', 'CREATE TABLE "t_late" ("id" int);'], B)
    const err = await applyMigrations(withLate, inTransaction, []).catch((e) => e)
    expect(err).toBeInstanceOf(MigrationOrderError)
    expect(err.message).toContain('0002_late.sql')
    expect(err.message).toContain('meta/0002_snapshot.json')
    expect(err.message).toContain('meta/_journal.json')
    expect(err.message).toContain('tinyzoo generate')
    expect(await exists(async (t, p) => (await pool.query(t, p as any[])).rows, 't_late')).toBe(false)
  })

  it('matches by created_at, not by hash: an applied migration edited afterwards is no problem', async () => {
    await reset()
    await applyMigrations(mini(A, B), inTransaction, [])
    const edited = mini(A, [2000, '0001_b', 'CREATE TABLE "t_b" ("id" int, "extra" text);'])
    expect(await applyMigrations(edited, inTransaction, [])).toEqual([])
  })

  it('applies a newer migration normally', async () => {
    await reset()
    await applyMigrations(mini(A), inTransaction, [])
    expect(await applyMigrations(mini(A, B), inTransaction, [])).toEqual(['0001_b'])
  })
})

describe('upgrade steps', () => {
  const trace: string[] = []
  const step = (id: string, phase: 'before' | 'after', extra: Partial<UpgradeStep> = {}): UpgradeStep => ({
    id, since: '0.2.0', description: id, phase,
    run: async ({ run }) => { trace.push(`${id}:${(await exists(run, 't_a')) ? 'table-exists' : 'no-table'}`) },
    ...extra,
  })

  it('runs `before` steps ahead of the pending migrations and `after` steps behind them', async () => {
    await reset()
    await applyMigrations(mini(A), inTransaction, []) // not a fresh install any more
    trace.length = 0
    await applyMigrations(mini(A, B), inTransaction, [step('late', 'after'), step('early', 'before')])
    expect(trace).toEqual(['early:table-exists', 'late:table-exists'])
    const order: string[] = []
    await reset()
    await applyMigrations(mini(A), inTransaction, [
      { ...step('first', 'before'), run: async ({ run }) => { order.push(`first:${await exists(run, 't_b')}`) } },
      { ...step('last', 'after'), run: async ({ run }) => { order.push(`last:${await exists(run, 't_b')}`) } },
    ])
    expect(order).toEqual([]) // fresh install: recorded, not run
    await applyMigrations(mini(A, B), inTransaction, [
      { ...step('first2', 'before'), run: async ({ run }) => { order.push(`first2:${await exists(run, 't_b')}`) } },
      { ...step('last2', 'after'), run: async ({ run }) => { order.push(`last2:${await exists(run, 't_b')}`) } },
    ])
    expect(order).toEqual(['first2:false', 'last2:true'])
  })

  it('records steps without running them on a fresh install, unless they ask to run', async () => {
    await reset()
    trace.length = 0
    const result = await runUpgrade(mini(A, B), inTransaction, [step('backfill', 'after'), step('needed', 'before', { freshInstall: 'run' })])
    expect(result.freshInstall).toBe(true)
    expect(result.steps).toEqual([{ id: 'needed', ran: true }, { id: 'backfill', ran: false }])
    expect(trace).toEqual(['needed:no-table'])
    expect(await appliedSteps()).toEqual(['backfill', 'needed'])
  })

  it('runs a step once: recorded steps are skipped on the next start', async () => {
    await reset()
    await applyMigrations(mini(A), inTransaction, [])
    trace.length = 0
    const steps = [step('once', 'after')]
    await applyMigrations(mini(A), inTransaction, steps)
    await applyMigrations(mini(A), inTransaction, steps)
    await applyMigrations(mini(A, B), inTransaction, steps)
    expect(trace).toEqual(['once:table-exists'])
    expect((await pool.query('select since, applied_at from cms_upgrades where id = $1', ['once'])).rows[0]).toMatchObject({ since: '0.2.0' })
  })

  it('runs a step with `when` whenever it holds, and not otherwise', async () => {
    await reset()
    await applyMigrations(mini(A), inTransaction, [])
    trace.length = 0
    const steps = [step('indexes', 'before', { when: ({ pendingStatements }) => pendingStatements.some((s) => s.includes('CREATE INDEX')) })]
    await applyMigrations(mini(A), inTransaction, steps)
    expect(trace).toEqual([])
    expect(await appliedSteps()).toEqual([])
    await applyMigrations(mini(A, B, [3000, '0002_c', 'CREATE INDEX "t_a_idx" ON "t_a" ("id");']), inTransaction, steps)
    expect(trace).toEqual(['indexes:table-exists'])
    expect(await appliedSteps()).toEqual(['indexes'])
  })

  it('picks up a database migrated by the old runner (no cms_upgrades table) on the next start', async () => {
    await reset()
    await migrate(drizzle(pool), { migrationsFolder: dir }) // drizzle's own migrator: no upgrade bookkeeping
    expect((await pool.query(`select to_regclass('cms_upgrades') as t`)).rows[0].t).toBeNull()
    trace.length = 0
    const result = await runUpgrade(source, inTransaction, [...CORE_UPGRADE_STEPS, step('backfill', 'after')])
    expect(result.migrations).toEqual([])
    expect(result.freshInstall).toBe(false)
    expect(trace).toEqual(['backfill:no-table']) // the playground's tables are there; the mini table is not
    expect(await appliedSteps()).toEqual(['backfill'])
  })

  it('runs inside the same transaction and advisory lock as the migrations', async () => {
    const log: string[] = []
    const fake = async <T>(fn: (run: SqlRunner) => Promise<T>) => {
      log.push('begin')
      const out = await fn(async (text) => {
        log.push(text.startsWith('select pg_advisory_xact_lock') ? 'lock' : text.slice(0, 40))
        return text.includes('to_regclass') ? [{ e: false }] : text.startsWith('select') ? [] : []
      })
      log.push('commit')
      return out
    }
    await runUpgrade(mini(A), fake, [step('s', 'before', { freshInstall: 'run', run: async ({ run }) => { await run('select 1 as marker') } })])
    expect(log[0]).toBe('begin')
    expect(log[1]).toBe('lock')
    expect(log.indexOf('select 1 as marker')).toBeGreaterThan(1)
    expect(log.indexOf('select 1 as marker')).toBeLessThan(log.indexOf('CREATE TABLE "t_a" ("id" int);'))
    expect(log.at(-1)).toBe('commit')
  })

  it('rolls everything back when a step fails: no half-applied upgrade', async () => {
    await reset()
    await applyMigrations(mini(A), inTransaction, [])
    const boom = step('boom', 'after', { run: async () => { throw new Error('boom') } })
    await expect(applyMigrations(mini(A, B), inTransaction, [boom])).rejects.toThrow('boom')
    expect(await exists(async (t, p) => (await pool.query(t, p as any[])).rows, 't_b')).toBe(false)
    expect((await pool.query('select count(*)::int as n from drizzle.__drizzle_migrations')).rows[0].n).toBe(1)
    expect(await appliedSteps()).toEqual([])
  })

  it('refuses duplicated or malformed step ids', async () => {
    await expect(applyMigrations(mini(A), inTransaction, [step('x', 'before'), step('x', 'after')])).rejects.toThrow('share the id')
    await expect(applyMigrations(mini(A), inTransaction, [step('Not Kebab', 'before')])).rejects.toThrow('kebab-case')
  })

  it('enables pg_trgm before the migration that needs it, even on an empty database', async () => {
    await reset()
    await pool.query('drop extension if exists pg_trgm cascade')
    const trgm = mini([1000, '0000_trgm', 'CREATE TABLE "t_s" ("q" text);--> statement-breakpoint\nCREATE INDEX "t_s_q" ON "t_s" USING gin ("q" gin_trgm_ops);'])
    const result = await runUpgrade(trgm, inTransaction, CORE_UPGRADE_STEPS)
    expect(result.steps).toEqual([{ id: 'enable-pg-trgm', ran: true }])
    expect(result.migrations).toEqual(['0000_trgm'])
  })
})

describe('inspectMigrations (tinyzoo status)', () => {
  const stepsList: UpgradeStep[] = [{ id: 'fill', since: '0.2.0', description: 'fills', phase: 'after', run: async () => {} }]
  const reader: SqlRunner = async (text, params) => (await pool.query(text, params as any[])).rows

  it('reads an empty database without changing it', async () => {
    await reset()
    const status = await inspectMigrations(mini(A, B), reader, stepsList)
    expect(status).toMatchObject({ freshInstall: true, applied: [], pending: ['0000_a', '0001_b'], outOfOrder: [], unknown: 0 })
    expect(status.steps).toMatchObject([{ id: 'fill', state: 'pending' }])
    expect((await pool.query(`select to_regclass('cms_upgrades') as t, to_regclass('drizzle.__drizzle_migrations') as m`)).rows[0]).toEqual({ t: null, m: null })
  })

  it('reports applied and pending migrations and steps, and an out-of-order migration', async () => {
    await reset()
    await applyMigrations(mini(A, B), inTransaction, stepsList)
    let status = await inspectMigrations(mini(A, B, [3000, '0002_c', 'select 1']), reader, stepsList)
    expect(status).toMatchObject({ freshInstall: false, applied: ['0000_a', '0001_b'], pending: ['0002_c'], outOfOrder: [] })
    expect(status.steps).toMatchObject([{ id: 'fill', state: 'applied' }])
    status = await inspectMigrations(mini(A, [1500, '0009_late', 'select 1'], B), reader, stepsList)
    expect(status.outOfOrder).toEqual(['0009_late'])
  })

  it('shows a conditional step as idle until a pending migration needs it', async () => {
    await reset()
    const cond: UpgradeStep[] = [{ id: 'trgm', since: '0.2.0', description: 'x', phase: 'before', when: ({ pendingStatements }) => pendingStatements.some((s) => s.includes('gin_trgm_ops')), run: async () => {} }]
    await applyMigrations(mini(A), inTransaction, cond)
    expect((await inspectMigrations(mini(A), reader, cond)).steps[0]!.state).toBe('idle')
    expect((await inspectMigrations(mini(A, [2000, '0001_s', 'CREATE INDEX x USING gin (q gin_trgm_ops)']), reader, cond)).steps[0]!.state).toBe('pending')
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
  it('recognises node-postgres timeouts and dropped sockets, which carry no code', () => {
    expect(isConnectionError(new Error('Connection terminated due to connection timeout', { cause: new Error('Connection terminated unexpectedly') }))).toBe(true)
    expect(isConnectionError(new Error('wrapped', { cause: new Error('Connection terminated unexpectedly') }))).toBe(true)
    expect(isConnectionError(new Error('relation "x" does not exist'))).toBe(false)
  })
  it('does not retry a failing statement', () => {
    expect(isConnectionError(Object.assign(new Error('syntax'), { code: '42601' }))).toBe(false)
  })
})
