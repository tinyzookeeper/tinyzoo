import { and, eq, sql } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { z } from 'zod'
import type { CmsUser } from './cmsSession'

/** The admin's view of one entry in a translation language (GET/PATCH response shape). */
export async function translationFormRow(db: any, reg: CmsRegistry, e: CmsEntity, row: any, locale: string) {
  const found = (await translationRows(db, e, [row.id], locale)).get(row.id)
  const tr = found ? upgradedCopy(e, found, { admin: true, recordId: row.id }) : found
  row.__defaults = Object.fromEntries(e.localized.map((k) => [k, row[k]]))
  for (const k of e.localized) row[k] = tr?.[k] ?? null
  row.__translated = !!tr
  // The translation's own version: what a translation save is checked against.
  row.__version = tr?.updatedAt ? new Date(tr.updatedAt).toISOString() : null
  return row
}

/**
 * Write the translation of one entry: only `.localized()` fields, empty = fall back to
 * the default language. Same access as editing the entry (row rules, and people who
 * cannot publish cannot change a live entry). The entry's own version (updatedAt) stays:
 * the translation has its own, so translating never conflicts with editing the entry
 * — but two people saving the same language do (X-CMS-Version, 409).
 */
export async function writeTranslation(event: any, e: CmsEntity, id: string, locale: string, user: CmsUser, rowFilter: any) {
  const { db, reg } = useCms()
  const t = e.localesTable
  if (!t) throw createError({ statusCode: 404, statusMessage: 'This content has nothing to translate' })

  const raw = (await readBody(event)) ?? {}
  // An emptied field means "use the default language".
  const cleaned = Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, v === '' ? null : v]))

  const [base] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!base) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  assertPublishAllowed(e, user, {}, base)
  const seenBefore = await changeSnapshot(e, id)

  // The translation as it is now: blocks that are behind or of a type that is gone are only kept when stored already.
  const before = (await translationRows(db, e, [id], locale)).get(id)
  const schema = z.object(Object.fromEntries(e.localized.map((k) => [k, (e.fields[k]!.zod('update', { stored: before?.[k] }) as any).nullable().optional()]))).strict()
  const data: Record<string, unknown> = parseOr422(schema, cleaned)
  const jsonKeys = e.localized.filter((k) => JSON_MEDIA_TYPES.has(e.fields[k]!.type) && k in data)
  const oldMedia = jsonKeys.flatMap((k) => jsonMediaIds(e.fields[k], before?.[k]))

  const baseTr = baseVersion(event)
  const { row, effect } = await db.transaction(async (tx: any) => {
    // Touch the entry first, under the same rules as editing it — including "not
    // live" for people who cannot publish, re-checked here at write time (an editor
    // may have published it since we read it).
    // A no-op update: it locks the entry and re-checks access at write time.
    const [touched] = await tx.update(e.table).set({ updatedAt: sql`${e.table.updatedAt}` })
      .where(both(both(eq(e.table.id, id), rowFilter), notLiveCond(e, user))).returning({ id: e.table.id })
    if (!touched) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    // The entry is locked now, so this is the translation as it stands.
    const [current] = await tx.select({ updatedAt: t.updatedAt }).from(t).where(and(eq(t.parentId, id), eq(t.locale, locale)))
    if (current) await assertCurrentVersion(e, { updatedAt: current.updatedAt, updatedBy: null }, baseTr)
    // A page tree: a translated address part (or a first translation) changes the address of the
    // page in this language and of every page below it.
    let writeTree: Awaited<ReturnType<typeof beginTreeWrite>> | null = null
    let wasLive = new Set<string>()
    const tp = e.tree ? treeProps(e) : null
    if (tp && (!current || (e.localized.includes(tp.slug) && tp.slug in data))) {
      // The parent and address part come from the tree under the lock, not from `base` (read before it).
      writeTree = await beginTreeWrite(tx, reg, e, (nodes) => {
        const node = nodes.find((n) => n.id === id)
        if (!node) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
        return {
          id, parentId: node.parentId, slug: node.slug, title: node.title ?? '',
          slugs: { [locale]: e.localized.includes(tp.slug) ? (data[tp.slug] as string | null | undefined) ?? null : null },
          locales: [...new Set([...(node.locales ?? []), locale])],
        }
      }, user)
      wasLive = await liveAmong(tx, e, subtreeIds(writeTree.nodes, id))
    }
    // A new version, never equal to the last one (clocks may differ between replicas).
    const now = new Date(Math.max(Date.now(), current ? new Date(current.updatedAt).getTime() + 1 : 0))
    const [saved] = await tx.insert(t).values({ parentId: id, locale, ...data, updatedAt: now })
      .onConflictDoUpdate({ target: [t.parentId, t.locale], set: { ...data, updatedAt: now } })
      .returning()
    const effect = writeTree ? await treeEffect(tx, reg, e, writeTree.nodes, writeTree.next, id, wasLive, actorId(user)) : null
    // A translated address part (or a first translation) may put the entry where a redirect leaves from: that one goes, in this transaction.
    if (e.content?.path && (!current || pathKeys(e.content.path).some((k) => k in data))) await dropRedirectsFromLiveAddresses(tx, reg, e, id)
    return { row: saved, effect }
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))

  if (oldMedia.length) {
    const still = new Set(jsonKeys.flatMap((k) => jsonMediaIds(e.fields[k], row[k])))
    const storage = useCmsStorage()
    for (const mid of new Set(oldMedia)) if (!still.has(mid)) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
  }
  await audit(event, 'entry.translate', { entity: e.name, recordId: id, meta: { locale } })
  await noteCollabSave(event, { entity: e, id, locale }, row.updatedAt)

  const [fresh] = await db.select().from(e.table).where(eq(e.table.id, id))
  await reportChange(event, { type: 'translation.updated', entity: e, id, locale, before: seenBefore, after: { updatedAt: row.updatedAt }, moved: effect?.moved })
  if (effect) await reportTreeRedirects(event, reg, effect.redirects)
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
  const seenBefore = await changeSnapshot(e, id)
  const { gone, effect } = await db.transaction(async (tx: any) => {
    const [touched] = await tx.update(e.table).set({ updatedAt: sql`${e.table.updatedAt}` })
      .where(both(both(eq(e.table.id, id), rowFilter), notLiveCond(e, user))).returning({ id: e.table.id })
    if (!touched) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
    // A page tree: without its translation the page falls back to the default language's address
    // part, and so does every page below it.
    const tp = e.tree ? treeProps(e) : null
    let writeTree: Awaited<ReturnType<typeof beginTreeWrite>> | null = null
    let wasLive = new Set<string>()
    if (tp) {
      writeTree = await beginTreeWrite(tx, reg, e, (nodes) => {
        const node = nodes.find((n) => n.id === id)
        if (!node) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
        return {
          id, parentId: node.parentId, slug: node.slug, title: node.title ?? '',
          slugs: { [locale]: null },
          locales: (node.locales ?? []).filter((l) => l !== locale),
        }
      }, user)
      wasLive = await liveAmong(tx, e, subtreeIds(writeTree.nodes, id))
    }
    const [deleted]: any[] = await tx.delete(t).where(and(eq(t.parentId, id), eq(t.locale, locale))).returning()
    if (!deleted) throw createError({ statusCode: 404, statusMessage: 'No translation in this language' })
    const effect = writeTree ? await treeEffect(tx, reg, e, writeTree.nodes, writeTree.next, id, wasLive, actorId(user)) : null
    return { gone: deleted, effect }
  })
  const storage = useCmsStorage()
  for (const k of e.localized) {
    for (const mid of new Set(jsonMediaIds(e.fields[k], gone[k]))) await gcMediaIfOrphan(db, reg, storage, mid, gcScope(user))
  }
  await audit(event, 'entry.translation_delete', { entity: e.name, recordId: id, meta: { locale } })
  await dropCollabDocuments(e.name, id, locale)
  await dropTranslationRevisions(e, id, locale)
  await reportChange(event, { type: 'translation.deleted', entity: e, id, locale, before: seenBefore, after: null, moved: effect?.moved })
  if (effect) await reportTreeRedirects(event, reg, effect.redirects)
  return { ok: true }
}

/** Media referenced by all translations of an entry (for cleanup when it is deleted). */
export async function translationMediaIds(db: any, e: CmsEntity, id: string): Promise<string[]> {
  if (!e.localesTable) return []
  const rows: any[] = await db.select().from(e.localesTable).where(eq(e.localesTable.parentId, id))
  return rows.flatMap((r) => e.localized.flatMap((k) => jsonMediaIds(e.fields[k], r[k])))
}
