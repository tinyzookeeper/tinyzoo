import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// The database driver: a node-postgres connection pool.
export function createCmsDb(url: string, schema: Record<string, unknown>) {
  // A request waiting for a free connection gives up after 10 s instead of hanging.
  return drizzle(new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 }), { schema })
}
