/**
 * Applying drizzle-kit migrations with drizzle's own bookkeeping — the same
 * `drizzle.__drizzle_migrations` table, hashes and ordering as `drizzle-kit migrate`,
 * so either tool can take over from the other. Web Crypto only.
 * A Postgres advisory lock makes concurrent starts take turns. Upgrade steps
 * (upgrades.ts) run in the same transaction and lock: `before` steps ahead of the
 * pending migrations, `after` steps behind them.
 */
import { docsUrl } from './docs'
import { sql, type SQL } from 'drizzle-orm'
import { assertValidSteps, runUpgradeSteps, stepIsDue, UPGRADES_TABLE_SQL, type StepOutcome, type UpgradeContext, type UpgradeStep } from './upgrades'

/** @internal */
export interface MigrationJournal { entries: { idx: number; when: number; tag: string }[] }
/** @internal */
export interface MigrationSource {
  journal: MigrationJournal
  readSql: (tag: string) => Promise<string>
}
/** Runs one SQL text with optional params; returns rows (what an upgrade step's `ctx.run` is). */
export type SqlRunner = (text: string, params?: unknown[]) => Promise<any[]>
/** @internal */
export type JournalEntry = MigrationJournal['entries'][number]

const LOCK = 72_011_003

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** @internal */
export interface MigrationClassification<T extends { idx: number; when: number }> {
  applied: T[]
  /** Newer than everything applied: will run. */
  pending: T[]
  /** Never applied, yet older than one that was: drizzle would skip it. */
  outOfOrder: T[]
  /** Applied in the database but absent from the journal (a newer version ran here). */
  unknown: number
}

/**
 * Sort the journal against what the database has recorded. Drizzle applies "everything
 * newer than the last applied migration", so a migration that is older than the newest
 * applied one and was never applied (two branches each generated one) would be skipped
 * for good. Entries are matched by `created_at` (the journal's `when`), not by hash: a
 * migration edited after it was applied must not look unapplied.
 *
 * @internal
 */
export function classifyMigrations<T extends { idx: number; when: number }>(entries: T[], appliedMillis: number[]): MigrationClassification<T> {
  const have = new Set(appliedMillis)
  const newest = appliedMillis.length ? Math.max(...appliedMillis) : null
  const out: MigrationClassification<T> = { applied: [], pending: [], outOfOrder: [], unknown: 0 }
  const known = new Set<number>()
  for (const e of [...entries].sort((a, b) => a.idx - b.idx)) {
    known.add(e.when)
    if (have.has(e.when)) out.applied.push(e)
    else if (newest !== null && e.when <= newest) out.outOfOrder.push(e)
    else out.pending.push(e)
  }
  out.unknown = [...have].filter((ms) => !known.has(ms)).length
  return out
}

/**
 * An unapplied migration older than the newest applied one: stopped instead of skipped.
 *
 * @internal
 */
export class MigrationOrderError extends Error {
  constructor(public readonly entries: JournalEntry[]) {
    super(orderMessage(entries))
    this.name = 'MigrationOrderError'
  }
}

/**
 * What to do about an out-of-order migration. Regenerating gives it a later date, which is
 * all that is needed if it ran nowhere; if it ran on another database that is not enough.
 *
 * @internal
 */
export const ORDER_FIX = {
  /** The fix: take it out and let `tinyzoo generate` write it again on top of the newest one. */
  regenerate: (files: string) => `Fix: in your migrations folder (server/db/migrations by default) delete ${files}, its snapshot (meta/<number>_snapshot.json) and its entry in meta/_journal.json, then run \`tinyzoo generate\` again — the new migration is dated now, so it sorts after the others.`,
  /** If it already ran somewhere (production, a colleague's database), the new one would run there a second time. */
  appliedElsewhere: 'If it already ran on another database (production, a colleague\'s), that is not enough: the regenerated migration is a new one to that database, and would repeat changes it already has. Before deploying, edit the new .sql so it can run twice (ADD COLUMN IF NOT EXISTS, CREATE TABLE / CREATE INDEX IF NOT EXISTS, DROP … IF EXISTS before ADD CONSTRAINT; keep any statements you wrote by hand). Deleting and regenerating without that breaks the deploy.',
}

function orderMessage(entries: JournalEntry[]): string {
  const files = entries.map((e) => `${e.tag}.sql`).join(', ')
  return `Migration${entries.length > 1 ? 's' : ''} ${files} ${entries.length > 1 ? 'were' : 'was'} never applied to this database, but a newer migration already was — `
    + 'usually two branches each generated one. Drizzle would skip it for good, so nothing is applied until this is fixed. '
    + `${ORDER_FIX.regenerate(files)} ${ORDER_FIX.appliedElsewhere} (More: ${docsUrl('neverApplied')})`
}

interface ReadMigration extends JournalEntry { hash: string; statements: string[] }

async function readMigrations(source: MigrationSource): Promise<ReadMigration[]> {
  const out: ReadMigration[] = []
  for (const entry of [...source.journal.entries].sort((a, b) => a.idx - b.idx)) {
    const query = await source.readSql(entry.tag)
    out.push({ ...entry, hash: await sha256Hex(query), statements: query.split('--> statement-breakpoint') })
  }
  return out
}

const statementsOf = (migrations: ReadMigration[]) => migrations.flatMap((m) => m.statements).map((s) => s.trim()).filter(Boolean)

/** @internal */
export interface UpgradeResult {
  /** Tags of the migrations applied. */
  migrations: string[]
  /** Upgrade steps that ran or were recorded, in order. */
  steps: StepOutcome[]
  /** The database had no applied migration before this run. */
  freshInstall: boolean
}

/**
 * Apply the pending migrations and upgrade steps. `transaction` must run the callback in
 * one transaction (so a failed migration or step leaves nothing half-applied). Throws
 * `MigrationOrderError` instead of skipping an out-of-order migration.
 *
 * @internal
 */
export async function runUpgrade(
  source: MigrationSource,
  transaction: <T>(fn: (run: SqlRunner) => Promise<T>) => Promise<T>,
  steps: UpgradeStep[],
): Promise<UpgradeResult> {
  assertValidSteps(steps)
  const migrations = await readMigrations(source)

  return transaction(async (run) => {
    await run('select pg_advisory_xact_lock($1)', [LOCK])
    await run('CREATE SCHEMA IF NOT EXISTS "drizzle"')
    await run('CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)')
    await run(UPGRADES_TABLE_SQL)
    const rows = await run('select created_at from "drizzle"."__drizzle_migrations"')
    const { pending, outOfOrder } = classifyMigrations(migrations, rows.map((r) => Number(r.created_at)))
    if (outOfOrder.length) throw new MigrationOrderError(outOfOrder)

    const done = new Set<string>((await run('select id from "cms_upgrades"')).map((r) => String(r.id)))
    const ctx: UpgradeContext = { run, pendingStatements: statementsOf(pending), freshInstall: rows.length === 0 }
    const outcomes = await runUpgradeSteps('before', steps, ctx, done)
    for (const m of pending) {
      for (const stmt of m.statements) if (stmt.trim()) await run(stmt)
      await run('insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)', [m.hash, m.when])
    }
    outcomes.push(...await runUpgradeSteps('after', steps, ctx, done))
    return { migrations: pending.map((m) => m.tag), steps: outcomes, freshInstall: ctx.freshInstall }
  })
}

/**
 * Apply every migration newer than the last one recorded, with the upgrade steps.
 * Returns the tags applied (see `runUpgrade` for the steps too).
 *
 * @internal
 */
export async function applyMigrations(
  source: MigrationSource,
  transaction: <T>(fn: (run: SqlRunner) => Promise<T>) => Promise<T>,
  steps: UpgradeStep[],
): Promise<string[]> {
  return (await runUpgrade(source, transaction, steps)).migrations
}

/** @internal */
export interface StepStatus {
  id: string
  since: string
  description: string
  phase: UpgradeStep['phase']
  /** applied: recorded. pending: due now. idle: has a `when` that does not hold right now. */
  state: 'applied' | 'pending' | 'idle'
}
/** @internal */
export interface MigrationStatus {
  /** No migration applied yet. */
  freshInstall: boolean
  applied: string[]
  pending: string[]
  outOfOrder: string[]
  /** Migrations the database has that this code's journal does not. */
  unknown: number
  steps: StepStatus[]
}

/**
 * What the database has and has not applied, without changing anything (`tinyzoo status`).
 * Missing bookkeeping tables read as "nothing applied yet".
 *
 * @internal
 */
export async function inspectMigrations(source: MigrationSource, run: SqlRunner, steps: UpgradeStep[]): Promise<MigrationStatus> {
  assertValidSteps(steps)
  const [{ migrations_table: hasMigrations, upgrades_table: hasUpgrades }] = await run(
    `select to_regclass('drizzle.__drizzle_migrations') is not null as migrations_table, to_regclass('cms_upgrades') is not null as upgrades_table`)
  const rows = hasMigrations ? await run('select created_at from "drizzle"."__drizzle_migrations"') : []
  const done = new Set<string>(hasUpgrades ? (await run('select id from "cms_upgrades"')).map((r) => String(r.id)) : [])
  const migrations = await readMigrations(source)
  const c = classifyMigrations(migrations, rows.map((r) => Number(r.created_at)))
  const ctx: UpgradeContext = { run, pendingStatements: statementsOf(c.pending), freshInstall: rows.length === 0 }
  const stepStatus: StepStatus[] = []
  for (const s of steps) {
    const state = s.when ? ((await stepIsDue(s, ctx, done)) ? 'pending' : done.has(s.id) ? 'applied' : 'idle')
      : done.has(s.id) ? 'applied' : 'pending'
    stepStatus.push({ id: s.id, since: s.since, description: s.description, phase: s.phase, state })
  }
  return {
    freshInstall: rows.length === 0,
    applied: c.applied.map((m) => m.tag),
    pending: c.pending.map((m) => m.tag),
    outOfOrder: c.outOfOrder.map((m) => m.tag),
    unknown: c.unknown,
    steps: stepStatus,
  }
}


/**
 * Positional params ($1, $2…) → a drizzle sql chunk with bound values. Without
 * params the text goes through untouched: migration SQL may contain `$1` in a
 * function body or `'$5'` in a literal.
 *
 * @internal
 */
export function sqlWithParams(text: string, params: unknown[] = []): SQL {
  if (!params.length) return sql.raw(text)
  const chunks: SQL[] = []
  let last = 0
  for (const m of text.matchAll(/\$(\d+)/g)) {
    const n = Number(m[1])
    if (n < 1 || n > params.length) continue
    chunks.push(sql.raw(text.slice(last, m.index)), sql`${params[n - 1]}`)
    last = m.index! + m[0].length
  }
  chunks.push(sql.raw(text.slice(last)))
  return sql.join(chunks, sql.raw(''))
}

const CONNECTION_ERRORS = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'EHOSTUNREACH', '57P03', '08000', '08001', '08003', '08006'])

const CONNECTION_MESSAGES = /^(Connection terminated (due to connection timeout|unexpectedly)|timeout expired)$/

/**
 * Could not reach the database (worth retrying), as opposed to a statement that failed.
 *
 * @internal
 */
export function isConnectionError(err: any): boolean {
  for (let e = err, depth = 0; e && depth < 4; e = e.cause, depth++) {
    if (CONNECTION_ERRORS.has(e.code)) return true
    if (Array.isArray(e.errors) && e.errors.some((x: any) => CONNECTION_ERRORS.has(x?.code))) return true
    // node-postgres reports a pool timeout and a dropped socket without a code.
    if (typeof e.message === 'string' && CONNECTION_MESSAGES.test(e.message)) return true
  }
  return false
}
