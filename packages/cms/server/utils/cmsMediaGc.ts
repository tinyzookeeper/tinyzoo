import { eq, sql } from '@my-cms/core'
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

/** Every (table, column) pair that holds a rich-text jsonb doc (may embed images). */
function richTextColumns(reg: CmsRegistry): { table: any; col: any }[] {
  const cols: { table: any; col: any }[] = []
  for (const e of reg.entities) {
    for (const [key, fld] of Object.entries(e.fields)) {
      if ((fld as any).type === 'richtext') cols.push({ table: e.table, col: (e.table as any)[key] })
    }
  }
  return cols
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
): Promise<void> {
  if (!mediaId) return
  // Load the row first so we can check references by storage key too (see above).
  const [m] = await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, mediaId))
  if (!m) return
  if (await isMediaReferenced(db, reg, mediaId, m.key)) return
  await storage.delete(m.key)
  await db.delete(reg.cmsMedia).where(eq(reg.cmsMedia.id, mediaId))
}
