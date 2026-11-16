import { looksLikeLinkRef } from 'tinyzoo'
import type { CmsRegistry } from 'tinyzoo'

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

/**
 * Normalise a path for lookup: decoded (browsers send /star%C3%A1, editors type
 * /stará), no query or fragment, no repeated or trailing slash (except "/").
 */
export function normalizePath(path: string): string {
  let p = (path.split(/[?#]/)[0] || '/').replace(/\/{2,}/g, '/')
  try {
    p = decodeURI(p)
  }
  catch { /* malformed escape: compare as sent */ }
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

/** A Location header value: non-ASCII percent-encoded (headers are ASCII), existing escapes kept. */
export function locationHeader(to: string): string {
  try {
    return encodeURI(decodeURI(to))
  }
  catch {
    return encodeURI(to)
  }
}

export async function findRedirect(path: string): Promise<Target | null> {
  const { db, reg } = useCms()
  const e = redirectEntity(reg)
  if (!e) return null
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows: any[] = await db.select({ from: e.table.from, to: e.table.to, permanent: e.table.permanent }).from(e.table)
    // A target picked from the site's pages is stored as a reference and follows the page
    // (in the default language); one whose page is gone or not published sends nobody anywhere.
    const refs = rows.map((r) => r.to).filter(looksLikeLinkRef)
    const resolved = refs.length ? await resolveLinkRefs(db, reg, refs, { locale: reg.locales?.default ?? null }) : new Map<string, string | null>()
    const usable = rows
      .map((r) => ({ ...r, to: looksLikeLinkRef(r.to) ? resolved.get(r.to) ?? null : r.to }))
      .filter((r): r is typeof r & { to: string } => typeof r.to === 'string' && !!r.to)
    cache = { at: Date.now(), map: new Map(usable.map((r) => [normalizePath(r.from), { to: r.to, status: r.permanent === false ? 302 : 301 }])) }
  }
  return cache.map.get(normalizePath(path)) ?? null
}

/**
 * Refuse a redirect that would send visitors in a circle: to its own address, or
 * through other redirects back to where it started (A → B → A). Such a page never
 * loads, so the save answers 422 on `to`, like any other wrong value.
 */
export async function assertNoRedirectLoop(e: any, values: Record<string, any>, old?: Record<string, any> | null): Promise<void> {
  if (e?.preset !== 'redirects') return
  const from = values.from ?? old?.from
  let to = values.to ?? old?.to
  if (typeof from !== 'string' || typeof to !== 'string') return
  const start = normalizePath(from)
  const sitePath = (v: string) => (v.startsWith('/') && !v.startsWith('//') ? normalizePath(v) : null)
  const { db, reg } = useCms()
  // Targets that are references to pages count as the pages' addresses (as served).
  const rows: any[] = await db.select({ id: e.table.id, from: e.table.from, to: e.table.to }).from(e.table)
  const refs = [to, ...rows.map((r) => r.to)].filter(looksLikeLinkRef)
  const resolved = refs.length ? await resolveLinkRefs(db, reg, refs, { locale: reg.locales?.default ?? null }) : new Map<string, string | null>()
  const address = (v: string) => (looksLikeLinkRef(v) ? resolved.get(v) ?? '' : v)
  to = address(to)
  let next = sitePath(to)
  if (next === null) return
  const map = new Map<string, string>()
  for (const r of rows) if (r.id !== old?.id) map.set(normalizePath(r.from), address(r.to))
  for (let hops = 0; next !== null && hops < 20; hops++) {
    if (next === start) {
      // Straight back to itself, or round through other redirects (A → B → A).
      const self = hops === 0
      throw createError({
        statusCode: 422, statusMessage: 'Validation failed',
        data: [{ code: self ? 'redirect_loop' : 'redirect_circle', path: ['to'], message: self ? 'This redirect would lead back to its own address' : 'This redirect would make a circle with other redirects' }],
      })
    }
    const hop = map.get(next)
    next = hop === undefined ? null : sitePath(hop)
  }
}
