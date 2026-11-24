import type { CmsRegistry } from 'tinyzoo'
import { createCmsDb } from '../db/driver'

/**
 * The current site's database (cmsSite.ts): one connection pool per site, made on first
 * use and ended when the site is unloaded. Single mode has one site, so one pool, as always.
 * The pool is built with the schema of the site's content model (cmsModel.ts).
 * Multi mode: the site's own address and user from the site directory, and no pool at all
 * for work that has no site (useCmsSite throws).
 */
const siteDb = cmsSiteScoped<ReturnType<typeof createCmsDb>>(() => {
  const { reg } = cmsSiteModel()
  if (cmsIsMultiTenant()) {
    const db = createCmsDb(useCmsSite('a database query').databaseUrl, reg.schema, { multiTenant: true, beforeConnect: roomForConnection })
    const quiet = cmsSiteQuietCheck()
    // Forget this pool for its site (the next query makes a new one), from wherever the cap decides it.
    const forget = bindToCmsSite(() => { if (siteDb.peek() === db) siteDb.reset() })
    open.pools.set((db as any).$client, { used: Date.now(), quiet, forget, asking: 0, granted: 0 })
    return db
  }
  // Read from the runtime environment only, never from the build (the platform
  // injects DATABASE_URL for a linked database).
  const env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
  const url = env.NUXT_CMS_DATABASE_URL || env.DATABASE_URL
  if (!url) throw createError({ statusCode: 500, statusMessage: 'No database address: set DATABASE_URL (or NUXT_CMS_DATABASE_URL)' })
  return createCmsDb(url, reg.schema)
}, { dispose: (db) => { open.pools.delete((db as any).$client); return (db as any).$client?.end?.() } })

/**
 * Multi-tenant mode: a cap on the connections of all sites of this process together
 * (NUXT_CMS_TENANCY_MAX_CONNECTIONS, default 30). Each site's pool closes its own
 * connections after 10 s of quiet; without a cap, many sites used within those seconds
 * would still add up past what Postgres allows. When the cap is reached, the pool of the
 * site that has been quiet longest is closed to make room: one with no connection in use,
 * nobody waiting for one and no request under way. When there is none, the query waits,
 * and gives up with a 503 after 10 s.
 *
 * A handle to a pool that was closed this way may still be in somebody's hands (work that
 * is not a request: a search index being built, something left running after a response).
 * Its next query is answered from the site's current pool, so closing a pool never fails
 * anybody's query.
 */
const open = cmsProcessWide({
  /** `asking`: callers of this pool waiting for room. `granted`: callers given room that have not taken their connection yet. */
  pools: new Map<any, { used: number; quiet: () => boolean; forget: () => void; asking: number; granted: number }>(),
  /** Connections of pools that were closed to make room and are not gone yet: they still count. */
  closing: 0,
  /** Room given to callers that will open a new connection in a moment: it counts until they have. */
  reserved: 0,
}, 'the pools of every site of the process, to keep the sum of their connections under one cap')

/** The connections of the current site's pool, if it has one (the operator's status route). */
export function cmsSiteConnections(): { open: number; idle: number } | null {
  const pool = (siteDb.peek() as any)?.$client
  return pool ? { open: pool.totalCount, idle: pool.idleCount } : null
}

/** The connections of all sites of this process, and the cap they share (multi-tenant mode). */
export function cmsConnectionsInUse(): { open: number; cap: number } {
  let total = open.closing + open.reserved
  for (const p of open.pools.keys()) total += p.totalCount
  return { open: total, cap: Number(process.env.NUXT_CMS_TENANCY_MAX_CONNECTIONS) || 30 }
}

async function roomForConnection(asked: any): Promise<{ pool: any; taken: () => void }> {
  // A handle to a closed pool: the site's pool of now (made if there is none).
  const pool = asked.ending || asked.ended ? (siteDb() as any).$client : asked
  const mine = open.pools.get(pool)
  if (!mine) return { pool, taken: () => {} }
  mine.used = Date.now()
  mine.asking++
  try {
    const max = Number(process.env.NUXT_CMS_TENANCY_MAX_CONNECTIONS) || 30
    const deadline = Date.now() + 10_000
    for (;;) {
      // Closed while this caller waited: start again with the site's current pool.
      if (pool.ending || pool.ended) return await roomForConnection(pool)
      // It has a connection waiting that no other caller was promised: nothing new is opened.
      if (pool.idleCount > mine.granted) {
        mine.granted++
        return { pool, taken: () => { mine.granted-- } }
      }
      let total = open.closing + open.reserved
      for (const p of open.pools.keys()) total += p.totalCount
      if (total < max) {
        open.reserved++
        return { pool, taken: () => { open.reserved-- } }
      }
      let victim: any = null
      let victimUsed = Infinity
      for (const [p, info] of open.pools) {
        if (p === pool || p.totalCount === 0 || p.totalCount !== p.idleCount || p.waitingCount > 0 || info.asking > 0 || info.granted > 0 || !info.quiet()) continue
        if (info.used < victimUsed) { victim = p; victimUsed = info.used }
      }
      if (victim) {
        open.pools.get(victim)!.forget()
        open.pools.delete(victim)
        const closing = victim.totalCount
        open.closing += closing
        void victim.end().catch(() => {}).then(() => { open.closing -= closing })
        // Its connections are gone when `end` has finished: look again then.
        await new Promise((r) => setTimeout(r, 5))
        continue
      }
      if (Date.now() > deadline) throw createError({ statusCode: 503, statusMessage: 'Too many database connections are in use; try again shortly' })
      await new Promise((r) => setTimeout(r, 50))
    }
  }
  finally {
    mine.asking--
  }
}

/**
 * DataSource seam. The DB instance is memoized per site (persistent process).
 * The driver is chosen at build time via `cms.db.driver` ('node' | 'edge'); the
 * runtime code here is identical for both — a single Postgres dialect.
 */
export function useCms(): { db: ReturnType<typeof createCmsDb>; reg: CmsRegistry } {
  return { db: siteDb(), reg: cmsSiteModel().reg }
}
