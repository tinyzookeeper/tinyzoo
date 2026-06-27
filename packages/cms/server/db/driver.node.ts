import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// Node runtime DB driver: node-postgres connection pool. This module is only
// imported when the host selects the 'node' driver (the module aliases #cms/db
// to it), so `pg` never reaches an edge/Workers bundle.
export function createCmsDb(url: string, schema: Record<string, unknown>) {
  return drizzle(new Pool({ connectionString: url }), { schema })
}
