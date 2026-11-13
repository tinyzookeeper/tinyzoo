import type { CmsRegistry } from '@my-cms/core'

// Redirects defined with defineRedirects(), served by the cms-redirects middleware.
// Loaded into memory and refreshed every 30 s (other replicas) or right after a
// redirect is created, changed or deleted on this instance.
type Target = { to: string; status: 301 | 302 }
let cache: { at: number; map: Map<string, Target> } | null = null
const TTL_MS = 30_000

export function redirectEntity(reg: CmsRegistry) {
  return reg.entities.find((e) => (e as any).preset === 'redirects')
}

export function invalidateRedirects(): void {
  cache = null
}

/** Normalise an incoming path for lookup: no query, no trailing slash (except "/"). */
export function normalizePath(path: string): string {
  const p = (path.split('?')[0] || '/').replace(/\/{2,}/g, '/')
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

export async function findRedirect(path: string): Promise<Target | null> {
  const { db, reg } = useCms()
  const e = redirectEntity(reg)
  if (!e) return null
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows: any[] = await db.select({ from: e.table.from, to: e.table.to, permanent: e.table.permanent }).from(e.table)
    cache = { at: Date.now(), map: new Map(rows.map((r) => [normalizePath(r.from), { to: r.to, status: r.permanent === false ? 302 : 301 }])) }
  }
  return cache.map.get(normalizePath(path)) ?? null
}
