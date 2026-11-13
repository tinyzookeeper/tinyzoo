import { and, blockMediaKeys, eq, inArray, isNull, lte, or, propOf, sql } from '@my-cms/core'
import type { CmsEntity, CmsRegistry } from '@my-cms/core'

const unique = <T>(arr: T[]): T[] => [...new Set(arr)]

/** Length-tolerant, content-constant-time string compare (no early-exit on mismatch). */
export function constantTimeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < max; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/** A public collection is one with `content.public`. 404 otherwise (never leak its existence as 403). */
export function getPublicEntity(reg: CmsRegistry, name: string | undefined): CmsEntity {
  const e = name ? reg.byName.get(name) : undefined
  if (!e || !e.content?.public) {
    throw createError({ statusCode: 404, statusMessage: `No public content collection: ${name}` })
  }
  return e
}

/**
 * The "is live" Drizzle condition for an entity (undefined = everything is public):
 * `content.published` — or, without one, the publish workflow's status — and, for
 * scheduled entries, a publish date that has come. Everything that decides what
 * visitors see goes through here: the content API, populated references, the
 * sitemap, webhooks.
 */
export function publishedCond(e: CmsEntity): any {
  const p = e.publish
  const status = p ? eq(e.table[propOf(p.field, e.fields[p.field]!)], p.publishedValue) : undefined
  const base = e.content?.published ? e.content.published(e.table) : status
  return both(base, scheduleCond(e))
}

/** "Its publish date has come" (or it has none), for entities whose publishing is scheduled. */
export function scheduleCond(e: CmsEntity): any {
  const p = e.publish
  if (!p?.dateField || p.schedule === false) return undefined
  const col = e.table[propOf(p.dateField, e.fields[p.dateField]!)]
  return or(isNull(col), lte(col, sql`now()`))
}

/** Optional API-token gate. No-op unless `cms.content.token` is configured. */
export function assertContentAuth(event: any): void {
  const token = (useRuntimeConfig().cms as any)?.content?.token
  if (!token) return
  const header = getHeader(event, 'authorization') || ''
  const provided = getHeader(event, 'x-api-key') || header.replace(/^Bearer\s+/i, '')
  if (!provided || !constantTimeEqual(provided, token)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid content API token' })
  }
}

/**
 * Is this request allowed to see unpublished drafts? Only when `?preview` is present
 * AND the caller is an authenticated CMS user (admin session) OR presents the content
 * token. Never lets an anonymous visitor bypass the published filter.
 */
export function isPreviewAuthorized(event: any): boolean {
  if (getQuery(event).preview === undefined) return false
  if (event.context?.cmsUser) return true
  const token = (useRuntimeConfig().cms as any)?.content?.token
  if (!token) return false
  const header = getHeader(event, 'authorization') || ''
  const provided = getHeader(event, 'x-api-key') || header.replace(/^Bearer\s+/i, '') || String(getQuery(event).preview || '')
  return !!provided && constantTimeEqual(provided, token)
}

/** AND the target's published condition into an id filter — so population never serves drafts. */
function withPublished(target: CmsEntity, idCond: any): any {
  const pub = publishedCond(target)
  return pub ? and(pub, idCond) : idCond
}

/** Cache headers: public+CDN-friendly when open, private+no-store when token-gated. */
export function setContentCache(event: any): void {
  const cfg = (useRuntimeConfig().cms as any)?.content ?? {}
  const cc = cfg.token
    ? 'private, no-store'
    : cfg.cacheControl || 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
  setResponseHeader(event, 'Cache-Control', cc)
}

/** Media → a lean public shape (never the storage key or internals). */
/** A file as the website gets it: alt text in the requested language, the focal point. */
function mediaProjection(m: any, locale: string | null = null) {
  if (!m) return m
  const alt = (locale && m.altLocales?.[locale]) || m.alt
  const focal = m.focalX != null && m.focalY != null ? { x: m.focalX, y: m.focalY } : null
  return { id: m.id, url: m.url, width: m.width, height: m.height, alt, mime: m.mime, focal }
}

/** Scalar-only projection of a related target (no deep nesting), respecting its own `hidden`. */
function projectScalars(target: CmsEntity, row: any) {
  const hidden = new Set(target.content?.hidden ?? [])
  const out: Record<string, any> = { id: row.id }
  for (const [key, fld] of Object.entries(target.fields)) {
    if (hidden.has(key) || fld.relation || fld.type === 'media' || fld.type === 'blocks' || fld.type === 'gallery') continue
    out[key] = row[key]
  }
  return out
}

/**
 * Safe projection of a populated relation target:
 *  - public target → its scalar fields (minus its hidden)
 *  - non-public target → a minimal reference {id, title}
 */
function publicProjection(target: CmsEntity, row: any) {
  if (target.content?.public) return projectScalars(target, row)
  return { id: row.id, [target.titleField]: row[target.titleField] }
}

/** Field keys that can be populated (media + to-one + m2m). */
function populatableKeys(e: CmsEntity): string[] {
  return Object.entries(e.fields)
    .filter(([, f]) => f.type === 'media' || f.relation?.kind === 'many-to-one' || f.relation?.kind === 'many-to-many')
    .map(([k]) => k)
}

/**
 * Resolve media + relations on `rows` IN PLACE (batched, depth 1). Nested targets
 * get a safe projection; non-listed fields are left as raw FK ids for projectItem to drop.
 */
export async function populateItems(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], populate?: string[], locale: string | null = null) {
  if (!rows.length) return
  await populateBlocks(db, reg, e, rows, locale)
  await populateGalleries(db, reg, e, rows, locale)
  const keys = populate ?? populatableKeys(e)
  for (const key of keys) {
    const fld = e.fields[key]
    if (!fld) continue

    if (fld.type === 'media') {
      const ids = unique(rows.map((r) => r[`${key}Id`]).filter(Boolean))
      const byId = new Map<string, any>()
      if (ids.length) {
        const media: any[] = await db.select().from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, ids))
        for (const m of media) byId.set(m.id, mediaProjection(m, locale))
      }
      for (const r of rows) r[key] = byId.get(r[`${key}Id`]) ?? null
    }
    else if (fld.relation?.kind === 'many-to-one') {
      const target = reg.byName.get(fld.relation.to().name)!
      const ids = unique(rows.map((r) => r[`${key}Id`]).filter(Boolean))
      const byId = new Map<string, any>()
      if (ids.length) {
        const targets: any[] = await db.select().from(target.table).where(withPublished(target, inArray(target.table.id, ids)))
        await overlayTranslations(db, reg, target, targets, locale)
        for (const t of targets) byId.set(t.id, publicProjection(target, t))
      }
      for (const r of rows) r[key] = byId.get(r[`${key}Id`]) ?? null
    }
    else if (fld.relation?.kind === 'many-to-many') {
      const j = reg.junctionByOwnerField.get(`${e.name}.${key}`)!
      const target = reg.byName.get(fld.relation.to().name)!
      const rowIds = rows.map((r) => r.id)
      const links: any[] = await db.select().from(j.table).where(inArray(j.table[j.ownerCol], rowIds))
      const targetIds = unique(links.map((l) => l[j.targetCol]))
      const tById = new Map<string, any>()
      if (targetIds.length) {
        const targets: any[] = await db.select().from(target.table).where(withPublished(target, inArray(target.table.id, targetIds)))
        await overlayTranslations(db, reg, target, targets, locale)
        for (const t of targets) tById.set(t.id, publicProjection(target, t))
      }
      const byOwner = new Map<string, any[]>()
      for (const l of links) {
        const arr = byOwner.get(l[j.ownerCol]) ?? []
        const proj = tById.get(l[j.targetCol])
        if (proj) arr.push(proj)
        byOwner.set(l[j.ownerCol], arr)
      }
      for (const r of rows) r[key] = byOwner.get(r.id) ?? []
    }
  }
}

/**
 * Blocks as the public API returns them (mirrored by content-shape blocksType): only
 * known block types; every block has id, type and each of its fields (null when
 * empty); media ids replaced by the public media object (batched across rows).
 */
async function populateBlocks(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], locale: string | null = null) {
  const blockFields = Object.entries(e.fields).filter(([, f]) => f.type === 'blocks' && f.blocks)
  if (!blockFields.length) return
  const ids = new Set<string>()
  for (const [key, fld] of blockFields) {
    const mediaKeys = blockMediaKeys(fld.blocks!)
    for (const r of rows) {
      for (const b of Array.isArray(r[key]) ? r[key] : []) {
        if (!b || typeof b.type !== 'string' || !Object.hasOwn(fld.blocks!, b.type)) continue
        for (const mk of mediaKeys.get(b.type) ?? []) if (typeof b[mk] === 'string' && b[mk]) ids.add(b[mk])
      }
    }
  }
  const byId = new Map<string, any>()
  if (ids.size) {
    const media: any[] = await db.select().from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, [...ids]))
    for (const m of media) byId.set(m.id, mediaProjection(m, locale))
  }
  for (const [key, fld] of blockFields) {
    const defs = fld.blocks!
    for (const r of rows) {
      r[key] = (Array.isArray(r[key]) ? r[key] : [])
        .filter((b: any) => b && typeof b === 'object' && typeof b.type === 'string' && Object.hasOwn(defs, b.type))
        .map((b: any) => {
          const out: Record<string, any> = { id: String(b.id), type: b.type }
          for (const [fk, bf] of Object.entries(defs[b.type]!.fields) as [string, any][]) {
            const v = b[fk] ?? null
            out[fk] = bf.type === 'media' ? (v ? byId.get(v) ?? null : null) : v
          }
          return out
        })
    }
  }
}

/**
 * Final public shape of a row: id + timestamps + non-hidden scalars + populated
 * relations. Raw FK columns (`${key}Id`) and hidden fields are never emitted.
 */
export function projectItem(e: CmsEntity, row: any) {
  const hidden = new Set(e.content?.hidden ?? [])
  const out: Record<string, any> = { id: row.id }
  for (const [key, fld] of Object.entries(e.fields)) {
    if (hidden.has(key)) continue
    if (fld.relation?.kind === 'one-to-many') continue // virtual
    if (fld.relation || fld.type === 'media') {
      if (key in row) out[key] = row[key] // populated; otherwise dropped
      continue
    }
    out[key] = row[key] // scalar
  }
  out.createdAt = row.createdAt
  out.updatedAt = row.updatedAt
  return out
}

/**
 * Which language each item is served in and which languages it exists in — added to
 * items of collections with translatable fields (mirrored by content-shape).
 */
export async function attachLocaleInfo(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], items: any[], locale: string | null) {
  if (!reg.locales || !e.localized.length) return
  const avail = await availableLocales(db, reg, e, rows.map((r) => r.id))
  items.forEach((item, i) => {
    item.locale = locale ?? reg.locales!.default
    item.locales = avail.get(rows[i].id) ?? [reg.locales!.default]
  })
}

/**
 * Match a localized text column in the requested language: the default-language
 * value, or the translation's (so filters and search work in every language).
 */
export function localizedMatch(reg: CmsRegistry, e: CmsEntity, key: string, locale: string | null, cond: (col: any) => any): any {
  const base = cond(e.table[key])
  if (!isTranslationLocale(reg, locale) || !e.localized.includes(key) || !e.localesTable) return base
  const t = e.localesTable
  return or(base, sql`exists (select 1 from ${t} where ${t.parentId} = ${e.table.id} and ${t.locale} = ${locale} and ${cond(t[key])})`)
}

/**
 * Galleries as the public API returns them: each item the public media object plus
 * its caption, in order; items whose file is gone are left out (batched across rows).
 */
async function populateGalleries(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], locale: string | null = null) {
  const keys = Object.entries(e.fields).filter(([, f]) => f.type === 'gallery').map(([k]) => k)
  if (!keys.length) return
  const ids = new Set<string>()
  for (const k of keys) for (const r of rows) for (const it of Array.isArray(r[k]) ? r[k] : []) if (typeof it?.mediaId === 'string') ids.add(it.mediaId)
  const byId = new Map<string, any>()
  if (ids.size) {
    const media: any[] = await db.select().from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, [...ids]))
    for (const m of media) byId.set(m.id, mediaProjection(m, locale))
  }
  for (const k of keys) {
    for (const r of rows) {
      r[k] = (Array.isArray(r[k]) ? r[k] : [])
        .filter((it: any) => byId.has(it?.mediaId))
        .map((it: any) => ({ ...byId.get(it.mediaId), caption: typeof it.caption === 'string' && it.caption ? it.caption : null }))
    }
  }
}
