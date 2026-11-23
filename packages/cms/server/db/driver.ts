import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// The database driver: a node-postgres connection pool.
export function createCmsDb(url: string, schema: Record<string, unknown>, opts: { multiTenant?: boolean } = {}) {
  // A request waiting for a free connection gives up after 10 s instead of hanging.
  if (!opts.multiTenant) return drizzle(new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 }), { schema })
  // One of many pools in this process: few connections each, closed after 10 s of quiet (so
  // only sites in use hold any), and an idle connection that breaks is logged instead of
  // being an unhandled error for every site.
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000, max: 3, idleTimeoutMillis: 10_000 })
  pool.on('error', (err) => console.error('[cms] a database connection of one site failed while idle:', err?.message ?? err))
  return drizzle(pool, { schema })
}
