import { eq, mediaIdsInBlocks, sql } from '@my-cms/core'
import type { CmsRegistry } from '@my-cms/core'
import type { StorageDriver } from './cmsStorage'

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
      if ((fld as any).type === 'richtext' || (fld as any).type === 'blocks') {
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
    else if ((fld as any).type === 'blocks' && row[key]) ids.push(...jsonMediaIds(fld, row[key]))
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
  if (await isMediaReferenced(db, reg, mediaId, m.key)) return
  await storage.delete(m.key)
  await db.delete(reg.cmsMedia).where(eq(reg.cmsMedia.id, mediaId))
}

/** Whose files a write by `user` may clean up: authors only their own, everyone else any. */
export function gcScope(user: { id: string; role: string }): { onlyUploadedBy?: string } {
  return user.role === 'author' ? { onlyUploadedBy: user.id } : {}
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
    const add = (rows: any[], locale: string | null = null) => {
      for (const r of rows) found.set(`${e.name}:${r.id}:${locale ?? ''}`, { entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), locale })
    }
    for (const [key, fld] of Object.entries(e.fields)) {
      const type = (fld as any).type
      if (type === 'media') {
        add(await db.select({ id: e.table.id, title }).from(e.table).where(both(eq((e.table as any)[`${key}Id`], mediaId), where)).limit(limit))
      }
      else if (type === 'richtext' || type === 'blocks') {
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
