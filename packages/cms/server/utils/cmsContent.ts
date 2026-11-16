import { and, inArray, or, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { publishedCond } from './cmsPublished'

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
 * Is the interactive API reference (/api/openapi) on? `cms.content.docs: true` / `false`
 * (env NUXT_CMS_CONTENT_DOCS) decides; left out, it is on in development and off in production.
 */
export function contentDocsEnabled(): boolean {
  const v = (useRuntimeConfig().cms as any)?.content?.docs
  if (v === true || v === 'true' || v === 1 || v === '1') return true
  if (v === false || v === 'false' || v === 0 || v === '0') return false
  return import.meta.dev || process.env.NODE_ENV !== 'production'
}

/**
 * Was this request made inside the server, by Nitro itself? The website's pages fetch
 * `/api/content/*` while they render (`useFetch`, `$fetch`, `event.$fetch`): Nitro answers
 * those from the same process, with no network in between, and builds the request from
 * its own stand-in for Node's `IncomingMessage` — the one that carries `__unenv__` (h3
 * relies on the same mark). A request that came over a socket never has it, whatever
 * headers it sends, so an outsider cannot pass for the site.
 */
export function isInProcessRequest(event: any): boolean {
  const req = event?.node?.req
  return !!req && typeof req === 'object' && '__unenv__' in req
}

/**
 * Optional API-token gate. No-op unless `cms.content.token` is configured. With a token the
 * API is closed to everyone who comes from outside without it — but the website's own
 * server-side requests (see isInProcessRequest) are the site itself, not a visitor, so
 * its pages render without the token ever being in their code or in a browser. (A
 * *browser* calling the API itself, e.g. on client-side navigation, is outside: it has no
 * token and must not get one.)
 */
export function assertContentAuth(event: any): void {
  const token = (useRuntimeConfig().cms as any)?.content?.token
  if (!token) return
  if (isInProcessRequest(event)) return
  const header = getHeader(event, 'authorization') || ''
  const provided = getHeader(event, 'x-api-key') || header.replace(/^Bearer\s+/i, '')
  if (!provided || !constantTimeEqual(provided, token)) {
    noteRefusedContentRequest(event)
    throw createError({ statusCode: 401, statusMessage: 'Invalid content API token' })
  }
}

let refusedCount = 0
let refusedLoggedAt = 0
/**
 * One log line when requests are refused for the token (at most one a minute, with how many
 * there were): a site that cannot read its own content, or a script with an old token, should
 * not fail in silence — and a scanner must not fill the log.
 */
function noteRefusedContentRequest(event: any): void {
  refusedCount++
  const now = Date.now()
  if (refusedLoggedAt && now - refusedLoggedAt < 60_000) return
  refusedLoggedAt = now
  const count = refusedCount
  refusedCount = 0
  const path = String(event?.path ?? '').split('?')[0]
  console.warn('[cms] ' + count + ' content API request' + (count === 1 ? '' : 's') + ' refused: no content token, or a wrong one (' + event?.method + ' ' + path + '). '
    + "The website's own server-side requests do not need it; a separate site or script sends it as x-api-key (NUXT_CMS_CONTENT_TOKEN). Later refusals are counted and logged at most once a minute.")
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

/**
 * Cache headers: public+CDN-friendly when open, private+no-store when token-gated or
 * for an editor's preview (drafts and unsaved values must never be cached).
 */
export function setContentCache(event: any): void {
  const cfg = (useRuntimeConfig().cms as any)?.content ?? {}
  const locked = cfg.token || isPreviewAuthorized(event)
  // Browsers check back every time (max-age=0) and get a quick 304 when nothing changed
  // (ETag, plugins/cms-content-etag.ts), so a published change shows immediately.
  // A CDN may keep an answer for 5 minutes; publish webhooks tell it what to purge sooner.
  const cc = locked ? 'private, no-store' : cfg.cacheControl || 'public, max-age=0, must-revalidate, s-maxage=300'
  setResponseHeader(event, 'Cache-Control', cc)
  if (!locked) event.context.cmsContentEtag = true
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
    if (hidden.has(key) || fld.relation || fld.type === 'media' || fld.type === 'blocks' || fld.type === 'group' || fld.type === 'gallery') continue
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
    .filter(([k, f]) => k !== e.tree?.parent && (f.type === 'media' || f.relation?.kind === 'many-to-one' || f.relation?.kind === 'many-to-many'))
    .map(([k]) => k)
}

/**
 * Resolve media + relations on `rows` IN PLACE (batched, depth 1). Nested targets
 * get a safe projection; non-listed fields are left as raw FK ids for projectItem to drop.
 */
export async function populateItems(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], populate?: string[], locale: string | null = null, opts: { preview?: boolean; user?: any } = {}) {
  if (!rows.length) return
  // Links to entries (`cms:<entity>/<id>`) become their current addresses, here and in
  // every populated target below: nothing leaves with a `cms:` in it.
  // In a preview a link reaches drafts, but only ones the signed-in previewer may read.
  const linkScope = { locale, preview: !!opts.preview, user: opts.user ?? null }
  // Stored JSON of an older shape is brought up to date before anything reads it.
  for (const r of rows) upgradeStoredJson(e, r)
  await resolveContentLinks(db, reg, e, rows, linkScope)
  await populateBlocks(db, reg, e, rows, locale)
  await populateGalleries(db, reg, e, rows, locale)
  const keys = populate ?? populatableKeys(e)
  for (const key of keys) {
    const fld = e.fields[key]
    // A page tree's parent is delivered as the parent's id, not populated.
    if (!fld || key === e.tree?.parent) continue

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
        for (const t of targets) upgradeStoredJson(target, t)
        await resolveContentLinks(db, reg, target, targets, linkScope)
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
        await resolveContentLinks(db, reg, target, targets, linkScope)
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
  const jsonFields = Object.entries(e.fields).filter(([, f]) => (f.type === 'blocks' && f.blocks) || (f.type === 'group' && f.fields))
  if (!jsonFields.length) return
  // Media ids from every block, group and the lists inside them, one query for all.
  const ids = new Set<string>()
  for (const [key, fld] of jsonFields) {
    for (const r of rows) collectFieldMedia(fld, r[key], ids)
  }
  const byId = new Map<string, any>()
  if (ids.size) {
    const media: any[] = await db.select().from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, [...ids]))
    for (const m of media) byId.set(m.id, mediaProjection(m, locale))
  }
  for (const [key, fld] of jsonFields) {
    for (const r of rows) r[key] = projectFieldValue(fld, r[key], byId)
  }
}

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Media ids inside one field value: a media field, a list's blocks, a group's fields. */
function collectFieldMedia(fld: any, value: unknown, ids: Set<string>) {
  if (fld.type === 'media') {
    if (typeof value === 'string' && value) ids.add(value)
  }
  else if (fld.type === 'blocks' && fld.blocks) collectBlockMedia(value, fld.blocks, ids)
  else if (fld.type === 'group' && fld.fields && isObject(value)) {
    for (const [k, inner] of Object.entries(fld.fields)) collectFieldMedia(inner, value[k], ids)
  }
}

function collectBlockMedia(value: unknown, defs: Record<string, any>, ids: Set<string>) {
  for (const b of Array.isArray(value) ? value : []) {
    if (!b || typeof b.type !== 'string' || !Object.hasOwn(defs, b.type)) continue
    for (const [fk, bf] of Object.entries(defs[b.type]!.fields) as [string, any][]) collectFieldMedia(bf, b[fk], ids)
  }
}

/**
 * One field inside a block or group as the API returns it: a media id becomes the
 * public media object, a list its projected items, a group an object with each of its
 * fields (null when empty), anything else as stored.
 */
function projectFieldValue(bf: any, raw: unknown, byId: Map<string, any>): any {
  const v = raw ?? null
  if (bf.type === 'media') return v ? byId.get(v as string) ?? null : null
  if (bf.type === 'blocks' && bf.blocks) return projectBlocks(v, bf.blocks, byId)
  if (bf.type === 'group' && bf.fields) {
    if (!isObject(v)) return null
    const out: Record<string, any> = {}
    for (const [gk, inner] of Object.entries(bf.fields)) out[gk] = projectFieldValue(inner, v[gk], byId)
    return out
  }
  return v
}

/** Known block types only; each field present (null when empty, a list inside a block: []). */
function projectBlocks(value: unknown, defs: Record<string, any>, byId: Map<string, any>): any[] {
  return (Array.isArray(value) ? value : [])
    .filter((b: any) => b && typeof b === 'object' && typeof b.type === 'string' && Object.hasOwn(defs, b.type))
    .map((b: any) => {
      const out: Record<string, any> = { id: String(b.id), type: b.type }
      for (const [fk, bf] of Object.entries(defs[b.type]!.fields) as [string, any][]) out[fk] = projectFieldValue(bf, b[fk], byId)
      return out
    })
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
    // A page tree's parent: the parent's id (the tree and the breadcrumbs say the rest).
    if (key === e.tree?.parent) {
      out[key] = row[`${key}Id`] ?? null
      continue
    }
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
 * Which language each item is served in, which languages it exists in and (for
 * collections with an address) its address in each — added to items of collections
 * with translatable fields (mirrored by content-shape).
 */
export async function attachLocaleInfo(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], items: any[], locale: string | null) {
  if (!reg.locales || !e.localized.length) return
  const ids = rows.map((r) => r.id)
  const avail = await availableLocales(db, reg, e, ids)
  // The item's address in each language, for collections that live at an address.
  const paths = e.content?.path ? await localePaths(db, reg, e, ids) : null
  items.forEach((item, i) => {
    item.locale = locale ?? reg.locales!.default
    item.locales = avail.get(rows[i].id) ?? [reg.locales!.default]
    if (paths) item.paths = paths.get(rows[i].id) ?? {}
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
