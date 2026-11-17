import { eq, mediaIdsInBlocks, mediaIdsInFields, sql } from 'tinyzoo'
import { deleteImageVariants } from './cmsImageSizes'
import type { CmsRegistry } from 'tinyzoo'
import type { StorageDriver } from './cmsStorage'

/** Field types storing JSON that can hold media ids (rich text images, blocks, galleries). */
export const JSON_MEDIA_TYPES = new Set(['richtext', 'blocks', 'gallery', 'group'])

/** Every (table, column) pair that holds a media FK, across all entities. */
function mediaColumns(reg: CmsRegistry): { table: any; col: any }[] {
  const cols: { table: any; col: any }[] = []
  for (const e of reg.entities) {
    for (const [key, fld] of Object.entries(e.fields)) {
      if ((fld as any).type === 'media') cols.push({ table: e.table, col: (e.table as any)[`${key}Id`] })
    }
  }
  return cols
}

/**
 * Every (table, column) pair holding jsonb that can reference media: rich text
 * (embedded images) and blocks (media fields and rich text inside blocks).
 */
function richTextColumns(reg: CmsRegistry): { table: any; col: any }[] {
  const cols: { table: any; col: any }[] = []
  for (const e of reg.entities) {
    for (const [key, fld] of Object.entries(e.fields)) {
      if (JSON_MEDIA_TYPES.has((fld as any).type)) {
        cols.push({ table: e.table, col: (e.table as any)[key] })
        // …and the same field in every translation.
        if ((fld as any).isLocalized && e.localesTable) cols.push({ table: e.localesTable, col: e.localesTable[key] })
      }
    }
  }
  return cols
}

/** Media ids referenced by one jsonb value of a field (rich text or blocks). */
export function jsonMediaIds(fld: any, value: unknown): string[] {
  if (fld?.type === 'blocks') return mediaIdsInBlocks(value, fld.blocks ?? {})
  if (fld?.type === 'group') return value && typeof value === 'object' ? mediaIdsInFields(fld.fields ?? {}, value as Record<string, any>) : []
  if (fld?.type === 'gallery') return Array.isArray(value) ? value.map((x: any) => x?.mediaId).filter((id: unknown): id is string => typeof id === 'string') : []
  return embeddedMediaIds(value)
}

/** Collect cms_media ids embedded in a rich-text doc (image nodes carry `mediaId`). */
export function embeddedMediaIds(doc: any, out: string[] = []): string[] {
  if (!doc || typeof doc !== 'object') return out
  if (typeof doc.attrs?.mediaId === 'string') out.push(doc.attrs.mediaId)
  if (Array.isArray(doc.content)) for (const child of doc.content) embeddedMediaIds(child, out)
  return out
}

/**
 * True if any entity row still references this media — as a FK, or embedded in rich
 * text. The rich-text scan matches BOTH the cms_media id (our images carry it as
 * `mediaId`) AND the storage key (always present in the image `src`), so an embedded
 * image whose `mediaId` was lost (paste/import/legacy) is still protected from GC.
 */
export async function isMediaReferenced(db: any, reg: CmsRegistry, mediaId: string, mediaKey?: string): Promise<boolean> {
  for (const { table, col } of mediaColumns(reg)) {
    const [hit] = await db.select({ id: table.id }).from(table).where(eq(col, mediaId)).limit(1)
    if (hit) return true
  }
  // A uuid (and the uuid-named storage key) can't contain LIKE wildcards, so these
  // substring matches are exact in practice.
  for (const { table, col } of richTextColumns(reg)) {
    const cond = mediaKey
      ? sql`cast(${col} as text) ilike ${`%${mediaId}%`} or cast(${col} as text) ilike ${`%${mediaKey}%`}`
      : sql`cast(${col} as text) ilike ${`%${mediaId}%`}`
    const [hit] = await db.select({ id: table.id }).from(table).where(cond).limit(1)
    if (hit) return true
  }
  return false
}

/** Media ids referenced by a single row — media FKs AND images embedded in its rich text. */
export function mediaIdsOf(reg: CmsRegistry, e: any, row: Record<string, any>): string[] {
  const ids: string[] = []
  for (const [key, fld] of Object.entries(e.fields)) {
    if ((fld as any).type === 'media' && row[`${key}Id`]) ids.push(row[`${key}Id`])
    else if ((fld as any).type === 'richtext' && row[key]) embeddedMediaIds(row[key], ids)
    else if (((fld as any).type === 'blocks' || (fld as any).type === 'gallery' || (fld as any).type === 'group') && row[key]) ids.push(...jsonMediaIds(fld, row[key]))
  }
  return ids
}

/**
 * Delete a media row + its blob IFF nothing references it anymore. Call AFTER the
 * referencing write has committed. A no-op for null or still-referenced ids.
 */
export async function gcMediaIfOrphan(
  db: any,
  reg: CmsRegistry,
  storage: StorageDriver,
  mediaId: string | null | undefined,
  scope: { onlyUploadedBy?: string } = {},
): Promise<void> {
  if (!mediaId) return
  // Load the row first so we can check references by storage key too (see above).
  const [m] = await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, mediaId))
  if (!m) return
  // Cleanup triggered by someone who may only delete their own files (authors) must
  // not remove anyone else's — pointing a draft at a file and clearing it would
  // otherwise be a way around that rule.
  if (scope.onlyUploadedBy !== undefined && m.uploadedBy !== scope.onlyUploadedBy) return
  // A library file stays until someone deletes it there (other pages may use it later,
  // and older versions in History still point at it).
  if (m.inLibrary) return
  if (await isMediaReferenced(db, reg, mediaId, m.key)) return
  await storage.delete(m.key)
  await deleteImageVariants(m.key)
  await db.delete(reg.cmsMedia).where(eq(reg.cmsMedia.id, mediaId))
}

/** Whose files a write by `user` may clean up: with media `'all'` any, otherwise only their own. */
export function gcScope(user: { id: string; role: string }): { onlyUploadedBy?: string } {
  return mediaAccess(user) === 'all' ? {} : { onlyUploadedBy: user.id }
}

/**
 * Where a file is used: the entries (and globals) holding it in a media field, in rich
 * text or in blocks — also in translations. Only entries this person may read are
 * listed. At most `limit`.
 */
export async function mediaUsage(db: any, reg: CmsRegistry, user: any, mediaId: string, mediaKey: string | undefined, limit = 50) {
  const found = new Map<string, { entity: string; id: string; title: string | null; locale: string | null }>()
  const like = (col: any) => (mediaKey
    ? sql`(cast(${col} as text) ilike ${'%' + mediaId + '%'} or cast(${col} as text) ilike ${'%' + mediaKey + '%'})`
    : sql`cast(${col} as text) ilike ${'%' + mediaId + '%'}`)
  for (const e of reg.entities) {
    if (found.size >= limit) break
    const { allowed, where } = accessWhere(e, 'read', user)
    if (!allowed) continue
    const title = (e.table as any)[e.titleField]
    // A file held by a field this person may not read is not told.
    const hidden = unreadableFields(e, user)
    const add = (rows: any[], locale: string | null = null) => {
      for (const r of rows) found.set(`${e.name}:${r.id}:${locale ?? ''}`, { entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), locale })
    }
    for (const [key, fld] of Object.entries(e.fields)) {
      if (hidden.has(key)) continue
      const type = (fld as any).type
      if (type === 'media') {
        add(await db.select({ id: e.table.id, title }).from(e.table).where(both(eq((e.table as any)[`${key}Id`], mediaId), where)).limit(limit))
      }
      else if (JSON_MEDIA_TYPES.has(type)) {
        add(await db.select({ id: e.table.id, title }).from(e.table).where(both(like((e.table as any)[key]), where)).limit(limit))
        const t = e.localesTable
        if ((fld as any).isLocalized && t) {
          const hits: any[] = await db.select({ parentId: t.parentId, locale: t.locale }).from(t).where(like(t[key])).limit(limit)
          for (const h of hits) {
            const [parent] = await db.select({ id: e.table.id, title }).from(e.table).where(both(eq(e.table.id, h.parentId), where))
            if (parent) add([parent], h.locale)
          }
        }
      }
    }
  }
  return [...found.values()].slice(0, limit)
}

/**
 * Is this file on the website right now: used by an entry visitors can see (live,
 * per its collection's rule) — in a media field, rich text or blocks, translations
 * included? Authors may not change such a file's public details.
 */
export async function isMediaLive(db: any, reg: CmsRegistry, mediaId: string, mediaKey?: string): Promise<boolean> {
  const like = (col: any) => (mediaKey
    ? sql`(cast(${col} as text) ilike ${'%' + mediaId + '%'} or cast(${col} as text) ilike ${'%' + mediaKey + '%'})`
    : sql`cast(${col} as text) ilike ${'%' + mediaId + '%'}`)
  for (const e of reg.entities) {
    // With per-language publishing the default language gates the others: a file is on the website while the entry is live in it.
    const live = publishedCond(e)
    for (const [key, fld] of Object.entries(e.fields)) {
      const type = (fld as any).type
      let cond: any = null
      if (type === 'media') cond = eq((e.table as any)[`${key}Id`], mediaId)
      else if (JSON_MEDIA_TYPES.has(type)) {
        cond = like((e.table as any)[key])
        const t = e.localesTable
        if ((fld as any).isLocalized && t) {
          cond = sql`(${cond} or exists (select 1 from ${t} where ${t.parentId} = ${e.table.id} and ${like(t[key])}))`
        }
      }
      if (!cond) continue
      const [hit] = await db.select({ id: e.table.id }).from(e.table).where(both(cond, live)).limit(1)
      if (hit) return true
    }
  }
  return false
}
