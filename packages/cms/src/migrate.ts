/**
 * Applying drizzle-kit migrations with drizzle's own bookkeeping — the same
 * `drizzle.__drizzle_migrations` table, hashes and ordering as `drizzle-kit migrate`,
 * so either tool can take over from the other. Web Crypto only (Node and Workers).
 * A Postgres advisory lock makes concurrent starts take turns.
 */
import { sql, type SQL } from 'drizzle-orm'

export interface MigrationJournal { entries: { idx: number; when: number; tag: string }[] }
export interface MigrationSource {
  journal: MigrationJournal
  readSql: (tag: string) => Promise<string>
}
/** Runs one SQL text with optional params; returns rows. */
export type SqlRunner = (text: string, params?: unknown[]) => Promise<any[]>

const LOCK = 72_011_003

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Apply every migration newer than the last one recorded. `transaction` must run the
 * callback in one transaction (so a failed migration leaves nothing half-applied).
 * Returns the tags applied.
 */
export async function applyMigrations(
  source: MigrationSource,
  transaction: <T>(fn: (run: SqlRunner) => Promise<T>) => Promise<T>,
): Promise<string[]> {
  const migrations: { tag: string; folderMillis: number; hash: string; statements: string[] }[] = []
  for (const entry of [...source.journal.entries].sort((a, b) => a.idx - b.idx)) {
    const query = await source.readSql(entry.tag)
    migrations.push({ tag: entry.tag, folderMillis: entry.when, hash: await sha256Hex(query), statements: query.split('--> statement-breakpoint') })
  }

  return transaction(async (run) => {
    await run('select pg_advisory_xact_lock($1)', [LOCK])
    await run('CREATE SCHEMA IF NOT EXISTS "drizzle"')
    await run('CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)')
    const [last] = await run('select id, hash, created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1')
    const applied: string[] = []
    for (const m of migrations) {
      if (last && Number(last.created_at) >= m.folderMillis) continue
      for (const stmt of m.statements) if (stmt.trim()) await run(stmt)
      await run('insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)', [m.hash, m.folderMillis])
      applied.push(m.tag)
    }
    return applied
  })
}


/**
 * Positional params ($1, $2…) → a drizzle sql chunk with bound values. Without
 * params the text goes through untouched: migration SQL may contain `$1` in a
 * function body or `'$5'` in a literal.
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

/** Could not reach the database (worth retrying), as opposed to a statement that failed. */
export function isConnectionError(err: any): boolean {
  for (let e = err, depth = 0; e && depth < 4; e = e.cause, depth++) {
    if (CONNECTION_ERRORS.has(e.code)) return true
    if (Array.isArray(e.errors) && e.errors.some((x: any) => CONNECTION_ERRORS.has(x?.code))) return true
  }
  return false
}
