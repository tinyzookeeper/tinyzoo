import { and, eq, sql } from '@my-cms/core'
import type { CmsEntity, CmsRegistry } from '@my-cms/core'
import { z } from 'zod'
import type { CmsUser } from './cmsSession'

/** The admin's view of one entry in a translation language (GET/PATCH response shape). */
export async function translationFormRow(db: any, reg: CmsRegistry, e: CmsEntity, row: any, locale: string) {
  const tr = (await translationRows(db, e, [row.id], locale)).get(row.id)
  row.__defaults = Object.fromEntries(e.localized.map((k) => [k, row[k]]))
  for (const k of e.localized) row[k] = tr?.[k] ?? null
  row.__translated = !!tr
  return row
}

/**
 * Write the translation of one entry: only `.localized()` fields, empty = fall back to
 * the default language. Same access as editing the entry (row rules, and people who
 * cannot publish cannot change a live entry). Bumps the entry's updatedAt/updatedBy.
 */
export async function writeTranslation(event: any, e: CmsEntity, id: string, locale: string, user: CmsUser, rowFilter: any) {
  const { db, reg } = useCms()
  const t = e.localesTable
  if (!t) throw createError({ statusCode: 404, statusMessage: 'This content has nothing to translate' })

  const raw = (await readBody(event)) ?? {}
  // An emptied field means "use the default language".
  const cleaned = Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, v === '' ? null : v]))
  const schema = z.object(Object.fromEntries(e.localized.map((k) => [k, (e.fields[k]!.zod('update') as any).nullable().optional()]))).strict()
  const data: Record<string, unknown> = parseOr422(schema, cleaned)

  const [base] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!base) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  assertPublishAllowed(e, user, {}, base)

  const jsonKeys = e.localized.filter((k) => ['richtext', 'blocks'].includes(e.fields[k]!.type) && k in data)
  const before = (await translationRows(db, e, [id], locale)).get(id)
  const oldMedia = jsonKeys.flatMap((k) => jsonMediaIds(e.fields[k], before?.[k]))

  const now = new Date()
  const row = await db.transaction(async (tx: any) => {
    const [saved] = await tx.insert(t).values({ parentId: id, locale, ...data, updatedAt: now })
      .onConflictDoUpdate({ target: [t.parentId, t.locale], set: { ...data, updatedAt: now } })
      .returning()
    await tx.update(e.table).set({ updatedAt: now, updatedBy: actorId(user) }).where(eq(e.table.id, id))
    return saved
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  if (oldMedia.length) {
    const still = new Set(jsonKeys.flatMap((k) => jsonMediaIds(e.fields[k], row[k])))
    const storage = useCmsStorage()
    for (const mid of new Set(oldMedia)) if (!still.has(mid)) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
  }
  await audit(event, 'entry.translate', { entity: e.name, recordId: id, meta: { locale } })

  const [fresh] = await db.select().from(e.table).where(eq(e.table.id, id))
  await hydrateRowForForm(db, reg, e, fresh)
  return translationFormRow(db, reg, e, fresh, locale)
}

/** Remove one entry's translation (falls back to the default language again). */
export async function deleteTranslation(event: any, e: CmsEntity, id: string, locale: string, user: CmsUser, rowFilter: any) {
  const { db, reg } = useCms()
  const t = e.localesTable
  if (!t) throw createError({ statusCode: 404, statusMessage: 'This content has nothing to translate' })
  const [base] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!base) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  assertPublishAllowed(e, user, {}, base)
  const [gone]: any[] = await (db as any).delete(t).where(and(eq(t.parentId, id), eq(t.locale, locale))).returning()
  if (!gone) throw createError({ statusCode: 404, statusMessage: 'No translation in this language' })
  const storage = useCmsStorage()
  for (const k of e.localized) {
    for (const mid of new Set(jsonMediaIds(e.fields[k], gone[k]))) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
  }
  await db.update(e.table).set({ updatedAt: sql`now()`, updatedBy: actorId(user) }).where(eq(e.table.id, id))
  await audit(event, 'entry.translation_delete', { entity: e.name, recordId: id, meta: { locale } })
  return { ok: true }
}

/** Media referenced by all translations of an entry (for cleanup when it is deleted). */
export async function translationMediaIds(db: any, e: CmsEntity, id: string): Promise<string[]> {
  if (!e.localesTable) return []
  const rows: any[] = await db.select().from(e.localesTable).where(eq(e.localesTable.parentId, id))
  return rows.flatMap((r) => e.localized.flatMap((k) => jsonMediaIds(e.fields[k], r[k])))
}
