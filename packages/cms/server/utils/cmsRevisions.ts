import { and, desc, eq, inArray, isNull, notInArray, type CmsEntity } from '@my-cms/core'

/**
 * Revisions: after every save, a snapshot of what was saved — the entry's field values
 * (or one translation's) exactly as the editor loads them — so the history panel can
 * list, compare and restore. Restoring loads a snapshot into the editor; saving it
 * then goes through the normal write path (access, publishing rules, version check).
 *
 * The newest `cms.revisions.keep` per entry and language are kept (default 50;
 * 0 turns revisions off). Deleting an entry deletes its revisions.
 */

/** The values a snapshot holds: the editable fields (+ media records for previews). */
function snapshotOf(e: CmsEntity, row: Record<string, any>, locale: string | null): Record<string, any> {
  const keys = Object.entries(e.fields)
    .filter(([key, f]) => (f as any).relation?.kind !== 'one-to-many' && (!locale || e.localized.includes(key)))
    .map(([key]) => key)
  const out: Record<string, any> = {}
  for (const k of keys) {
    out[k] = row[k] ?? null
    if (row[`${k}__media`] !== undefined) out[`${k}__media`] = row[`${k}__media`]
  }
  return out
}

const keepCount = () => {
  const n = Number((useRuntimeConfig().cms as any)?.revisions?.keep ?? 50)
  return Number.isFinite(n) ? n : 50
}

/** Record what a save stored. Never fails the save. */
export async function recordRevision(event: any, e: CmsEntity, id: string, locale: string | null, action: string): Promise<void> {
  const keep = keepCount()
  if (keep <= 0) return
  try {
    const { db, reg } = useCms()
    const r = reg.cmsRevisions
    const [row] = await db.select().from(e.table).where(eq(e.table.id, id))
    if (!row) return
    await hydrateRowForForm(db, reg, e, row)
    let version = row.updatedAt ?? null
    if (locale) {
      const tr = (await translationRows(db, e, [id], locale)).get(id)
      for (const k of e.localized) row[k] = tr?.[k] ?? null
      version = tr?.updatedAt ?? null
    }
    const data = snapshotOf(e, row, locale)
    const sameLocale = locale ? eq(r.locale, locale) : isNull(r.locale)
    const [prev]: any[] = await db.select({ data: r.data }).from(r)
      .where(and(eq(r.entity, e.name), eq(r.recordId, id), sameLocale)).orderBy(desc(r.createdAt)).limit(1)
    // The first one has nothing to compare with: it changed nothing in particular.
    const changed = prev ? Object.keys(data).filter((k) => !k.endsWith('__media') && stableJson(data[k]) !== stableJson(prev.data?.[k])) : []
    await db.insert(r).values({ entity: e.name, recordId: id, locale, action, version, data, changed, userId: event?.context?.cmsUser?.id ?? null })
    // Keep the newest `keep`.
    const newest: any[] = await db.select({ id: r.id }).from(r)
      .where(and(eq(r.entity, e.name), eq(r.recordId, id), sameLocale)).orderBy(desc(r.createdAt)).limit(keep)
    if (newest.length === keep) {
      await db.delete(r).where(and(eq(r.entity, e.name), eq(r.recordId, id), sameLocale, notInArray(r.id, newest.map((x) => x.id))))
    }
  }
  catch (err) {
    console.error('[cms] could not record a revision', (err as Error)?.message ?? err)
  }
}

/** Forget an entry's revisions (it was deleted). */
export async function dropRevisions(e: CmsEntity, id: string): Promise<void> {
  try {
    const { db, reg } = useCms()
    await db.delete(reg.cmsRevisions).where(and(eq(reg.cmsRevisions.entity, e.name), eq(reg.cmsRevisions.recordId, id)))
  }
  catch (err) {
    console.error('[cms] could not drop revisions', (err as Error)?.message ?? err)
  }
}

/** The history of one entry (or translation), newest first, with who saved each. */
export async function listRevisions(e: CmsEntity, id: string, locale: string | null) {
  const { db, reg } = useCms()
  const r = reg.cmsRevisions
  const rows: any[] = await db.select({ id: r.id, action: r.action, version: r.version, changed: r.changed, userId: r.userId, createdAt: r.createdAt })
    .from(r).where(and(eq(r.entity, e.name), eq(r.recordId, id), locale ? eq(r.locale, locale) : isNull(r.locale)))
    .orderBy(desc(r.createdAt)).limit(200)
  const ids = [...new Set(rows.map((x) => x.userId).filter(Boolean))] as string[]
  const users: any[] = ids.length ? await db.select({ id: reg.cmsUsers.id, name: reg.cmsUsers.name, email: reg.cmsUsers.email }).from(reg.cmsUsers).where(inArray(reg.cmsUsers.id, ids)) : []
  const names = new Map(users.map((u) => [u.id, displayName(u.name, u.email)]))
  return rows.map((x) => ({ ...x, byName: x.userId ? names.get(x.userId) ?? null : null }))
}
