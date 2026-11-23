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
      // The room is given back once the pool's own counts show this caller. A NEW connection is
      // counted before `connect` returns. An IDLE one is handed out on the pool's next tick, and
      // so is the new connection of a caller that was queued behind an idle one: until that tick
      // the pool still shows the idle connection as free and the new one not at all. Giving the
      // room back before it let the cap promise the same idle connection to the next caller (the
      // pool then opened a connection nobody had made room for) and lend the same room twice.
      // `nextTick` runs after the pool's own, which `connect` queued first.
      const client = opts.beforeConnect!(pool).then((room) => {
        try { return ((room.pool as any).cmsConnect as () => Promise<any>)() }
        finally { process.nextTick(room.taken) }
      })
      if (!cb) return client
      client.then((c) => cb(undefined, c, c.release), (err) => cb(err, undefined, () => {}))
    }
    // `end()` of node-postgres' pool resolves when the pool has let go of its connections,
    // which is before their sockets are closed. The cap counts the connections of a pool it
    // closed until `end()` has finished, and a site that is unloaded is gone when its pool
    // says so: `end()` waits for the connections themselves (a few seconds at most).
    const open = new Set<any>()
    pool.on('connect', (client: any) => {
      open.add(client)
      client.once('end', () => open.delete(client))
    })
    const end = pool.end.bind(pool) as () => Promise<void>
    ;(pool as any).end = (cb?: (err?: unknown) => void) => {
      const ended = end().then(() => new Promise<void>((resolve) => {
        if (!open.size) return resolve()
        const timer = setTimeout(resolve, 5_000)
        timer.unref?.()
        for (const client of open) client.once('end', () => { if (!open.size) { clearTimeout(timer); resolve() } })
      }))
      if (!cb) return ended
      ended.then(() => cb(), cb)
    }
  }
  return drizzle(pool, { schema })
}
