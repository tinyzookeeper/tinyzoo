import { inArray, looksLikeLinkRef, sitePrefix } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'

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

/**
 * Where a redirect sends a visitor who asked for `requested`: `to`, with the request's query
 * carried over, before the target's #anchor (after it, the browser takes it as part of the
 * anchor). A target with a query of its own is kept as it is.
 */
export function redirectDestination(to: string, requested: string): string {
  const q = requested.indexOf('?')
  const query = q < 0 ? '' : requested.slice(q + 1).split('#')[0]!
  const hash = to.indexOf('#')
  const base = hash < 0 ? to : to.slice(0, hash)
  const anchor = hash < 0 ? '' : to.slice(hash)
  return base.includes('?') || !query ? to : `${base}?${query}${anchor}`
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

/**
 * The language a redirect's old address is in, by the site's prefix rule
 * (`defineLocales({ prefix })`): '/en/old' is English, '/old' the default language. A site
 * with no prefix for its languages cannot tell, and gets the default language.
 */
export function redirectLocale(reg: CmsRegistry, from: string): string | null {
  const locales = reg.locales
  if (!locales) return null
  const path = normalizePath(from)
  for (const l of locales.locales) {
    const prefix = sitePrefix(locales, l)
    if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return l
  }
  return locales.default
}

/**
 * Where each redirect leads, as a visitor would be sent: a target stored as a reference
 * to a page is that page's current address in the language of the old address (`/en/old`
 * leads to the English page); one whose page is gone or not published leads nowhere (null).
 * Addresses are returned as stored. Aligned with `rows`.
 */
async function redirectTargets(db: any, reg: CmsRegistry, rows: { from: string; to: unknown }[]): Promise<(string | null)[]> {
  const wanted = new Map<string | null, Set<string>>()
  for (const r of rows) {
    if (typeof r.to !== 'string' || !looksLikeLinkRef(r.to)) continue
    const locale = redirectLocale(reg, r.from)
    wanted.set(locale, (wanted.get(locale) ?? new Set()).add(r.to))
  }
  const resolved = new Map<string | null, Map<string, string | null>>()
  for (const [locale, refs] of wanted) resolved.set(locale, await resolveLinkRefs(db, reg, refs, { locale }))
  return rows.map((r) => {
    if (typeof r.to !== 'string' || !r.to) return null
    return looksLikeLinkRef(r.to) ? resolved.get(redirectLocale(reg, r.from))?.get(r.to) ?? null : r.to
  })
}

export async function findRedirect(path: string): Promise<Target | null> {
  const { db, reg } = useCms()
  const e = redirectEntity(reg)
  if (!e) return null
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows: any[] = await db.select({ from: e.table.from, to: e.table.to, permanent: e.table.permanent }).from(e.table)
    // A target picked from the site's pages is stored as a reference and follows the page
    // (in the language of the old address); one whose page is gone or not published sends nobody anywhere.
    const targets = await redirectTargets(db, reg, rows)
    const map = new Map<string, Target>()
    rows.forEach((r, i) => {
      const to = targets[i]
      // A page that has taken over the old address answers there itself: a redirect that
      // leads to its own address would only send the visitor round and round.
      if (!to || normalizePath(to) === normalizePath(r.from)) return
      map.set(normalizePath(r.from), { to, status: r.permanent === false ? 302 : 301 })
    })
    cache = { at: Date.now(), map }
  }
  return cache.map.get(normalizePath(path)) ?? null
}

/**
 * An entry went live at (or moved to) these addresses: redirects away from them are
 * removed, or they would hide the entry. Run in the transaction of the write (`tx`),
 * so the entry and the removal land together. Returns the redirects removed.
 */
export async function dropRedirectsFrom(tx: any, reg: CmsRegistry, addresses: string[]): Promise<number> {
  const re = redirectEntity(reg)
  const from = [...new Set(addresses.filter(Boolean))]
  if (!re || !from.length) return 0
  const gone: any[] = await tx.delete(re.table).where(inArray(re.table.from, from)).returning({ id: re.table.id })
  if (gone.length) invalidateRedirects()
  return gone.length
}

/**
 * After a write to a linkable entry (any collection with an address, not only a page
 * tree): drop the redirects away from the addresses it is live at now, in every language.
 * `redirects.from` is unique, so a page that takes over an old address answers there.
 */
export async function dropRedirectsFromLiveAddresses(tx: any, reg: CmsRegistry, e: CmsEntity, id: string): Promise<number> {
  if (!redirectEntity(reg) || e.singleton || !e.content?.path) return 0
  const now = await changeSnapshot(e, id, tx)
  return now.live ? dropRedirectsFrom(tx, reg, now.paths.map((p) => p.path)) : 0
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
  // Targets that are references to pages count as the pages' addresses (as served, in the language of each old address).
  const rows: any[] = await db.select({ id: e.table.id, from: e.table.from, to: e.table.to }).from(e.table)
  const others = rows.filter((r) => r.id !== old?.id)
  const targets = await redirectTargets(db, reg, [{ from, to }, ...others])
  to = targets[0] ?? ''
  let next = sitePath(to)
  if (next === null) return
  const map = new Map<string, string>()
  others.forEach((r, i) => map.set(normalizePath(r.from), targets[i + 1] ?? ''))
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
