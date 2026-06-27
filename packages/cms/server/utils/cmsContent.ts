import { and, inArray } from '@my-cms/core'
import type { CmsEntity, CmsRegistry } from '@my-cms/core'

const unique = <T>(arr: T[]): T[] => [...new Set(arr)]

/** Length-tolerant, content-constant-time string compare (no early-exit on mismatch). */
function constantTimeEqual(a: string, b: string): boolean {
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

/** The "is published" Drizzle condition for an entity (undefined = everything is public). */
export function publishedCond(e: CmsEntity): any {
  return e.content?.published ? e.content.published(e.table) : undefined
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
function mediaProjection(m: any) {
  return m && { id: m.id, url: m.url, width: m.width, height: m.height, alt: m.alt, mime: m.mime }
}

/** Scalar-only projection of a related target (no deep nesting), respecting its own `hidden`. */
function projectScalars(target: CmsEntity, row: any) {
  const hidden = new Set(target.content?.hidden ?? [])
  const out: Record<string, any> = { id: row.id }
  for (const [key, fld] of Object.entries(target.fields)) {
    if (hidden.has(key) || fld.relation || fld.type === 'media') continue
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
export async function populateItems(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], populate?: string[]) {
  if (!rows.length) return
  const keys = populate ?? populatableKeys(e)
  for (const key of keys) {
    const fld = e.fields[key]
    if (!fld) continue

    if (fld.type === 'media') {
      const ids = unique(rows.map((r) => r[`${key}Id`]).filter(Boolean))
      const byId = new Map<string, any>()
      if (ids.length) {
        const media: any[] = await db.select().from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, ids))
        for (const m of media) byId.set(m.id, mediaProjection(m))
      }
      for (const r of rows) r[key] = byId.get(r[`${key}Id`]) ?? null
    }
    else if (fld.relation?.kind === 'many-to-one') {
      const target = reg.byName.get(fld.relation.to().name)!
      const ids = unique(rows.map((r) => r[`${key}Id`]).filter(Boolean))
      const byId = new Map<string, any>()
      if (ids.length) {
        const targets: any[] = await db.select().from(target.table).where(withPublished(target, inArray(target.table.id, ids)))
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
