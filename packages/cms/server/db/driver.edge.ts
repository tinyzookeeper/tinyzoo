import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'

// Edge/Workers runtime DB driver: Neon serverless over WebSocket (fetch + WS, no
// node TCP), which — unlike neon-http — supports the interactive transactions the
// CRUD layer uses. Imported only when the host selects the 'edge' driver.
export function createCmsDb(url: string, schema: Record<string, unknown>) {
  return drizzle(new Pool({ connectionString: url }), { schema })
}
