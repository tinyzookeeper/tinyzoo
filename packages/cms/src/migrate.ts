/**
 * Applying drizzle-kit migrations with drizzle's own bookkeeping — the same
 * `drizzle.__drizzle_migrations` table, hashes and ordering as `drizzle-kit migrate`,
 * so either tool can take over from the other. Web Crypto only (Node and Workers).
 * A Postgres advisory lock makes concurrent starts take turns.
 */
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

