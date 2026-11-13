import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// The database driver: a node-postgres connection pool.
export function createCmsDb(url: string, schema: Record<string, unknown>) {
  return drizzle(new Pool({ connectionString: url }), { schema })
}
