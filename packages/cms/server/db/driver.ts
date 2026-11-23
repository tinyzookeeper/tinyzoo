import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

/** What the cap answers a caller that asked for room: the pool to take the connection from, and `taken()` to call once it was asked for. */
export interface CmsConnectionRoom { pool: Pool; taken: () => void }

// The database driver: a node-postgres connection pool.
export function createCmsDb(url: string, schema: Record<string, unknown>, opts: { multiTenant?: boolean; beforeConnect?: (pool: Pool) => Promise<CmsConnectionRoom> } = {}) {
  // A request waiting for a free connection gives up after 10 s instead of hanging.
  if (!opts.multiTenant) return drizzle(new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 }), { schema })
  // One of many pools in this process: few connections each, closed after 10 s of quiet (so
  // only sites in use hold any), and an idle connection that breaks is logged instead of
  // being an unhandled error for every site.
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000, max: 3, idleTimeoutMillis: 10_000 })
  pool.on('error', (err) => console.error('[cms] a database connection of one site failed while idle:', err?.message ?? err))
  if (opts.beforeConnect) {
    // Every query and every transaction takes its connection through `connect` (pool.query
    // does too): the one place to wait for room under the process's cap (cmsDb.ts). The cap
    // may answer with another pool: this one was closed to make room, and the site has a new one.
    const connect = pool.connect.bind(pool) as () => Promise<any>
    ;(pool as any).cmsConnect = connect
    ;(pool as any).connect = (cb?: (err: unknown, client?: any, done?: (release?: any) => void) => void) => {
      // `connect` adds the new connection to its pool's count before it returns: the room that
      // was held for it is given back at that very moment, so it is counted exactly once.
      const client = opts.beforeConnect!(pool).then((room) => {
        try { return ((room.pool as any).cmsConnect as () => Promise<any>)() }
        finally { room.taken() }
      })
      if (!cb) return client
      client.then((c) => cb(undefined, c, c.release), (err) => cb(err, undefined, () => {}))
    }
  }
  return drizzle(pool, { schema })
}
