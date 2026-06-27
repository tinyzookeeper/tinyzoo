import { eq } from '@my-cms/core'
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

/** True if any entity row still references this media id (reference counting). */
export async function isMediaReferenced(db: any, reg: CmsRegistry, mediaId: string): Promise<boolean> {
  for (const { table, col } of mediaColumns(reg)) {
    const [hit] = await db.select({ id: table.id }).from(table).where(eq(col, mediaId)).limit(1)
    if (hit) return true
  }
  return false
}

/** Media ids referenced by a single row (used when its owning row is deleted). */
export function mediaIdsOf(reg: CmsRegistry, e: any, row: Record<string, any>): string[] {
  const ids: string[] = []
  for (const [key, fld] of Object.entries(e.fields)) {
    if ((fld as any).type === 'media' && row[`${key}Id`]) ids.push(row[`${key}Id`])
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
  if (await isMediaReferenced(db, reg, mediaId)) return
  const [m] = await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, mediaId))
  if (!m) return
  await storage.delete(m.key)
  await db.delete(reg.cmsMedia).where(eq(reg.cmsMedia.id, mediaId))
}
