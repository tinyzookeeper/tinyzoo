import { eq } from 'tinyzoo'

/**
 * The refusal for an entry that is still used: it names what uses it, but only what this
 * person may read (a row-level `access.read` rule can hide an entry); the rest is a count.
 */
async function inUse(db: any, reg: any, user: any, used: { entity: string; id: string }[]) {
  const { visible, hidden } = await splitReadable(db, reg, user, used)
  return createError({ statusCode: 409, statusMessage: 'Still in use by other content', data: { code: 'in_use', usedBy: visible.map(({ fields: _fields, ...rest }: any) => rest), ...(hidden ? { hidden } : {}) } })
}

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Globals are not deletable' })
  const id = getIdParam(event)
  // ?locale=<translation>: remove only that translation (needs edit rights, not delete).
  const locale = requestedLocale(event, reg)
  if (isTranslationLocale(reg, locale)) return deleteTranslation(event, e, id, locale, user, authorize(e, 'update', user))
  const rowFilter = authorize(e, 'delete', user)

  // People who may not publish cannot take a live entry off the website by deleting it.
  const [current] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })
  assertPublishAllowed(e, user, {}, current)
  // A page tree: pages below this one would lose their place (and their address): move or delete them first.
  if (e.tree) await assertNoChildren(db, e, id, await readableTreeIds(db, e, user))
  // Menus and links that point at this entry (by reference) would go dead: refused, saying which.
  const linked = await linksTo(db, reg, e, id)
  if (linked.length) throw await inUse(db, reg, user, [...await usedBy(db, reg, e, id), ...linked.map((l) => ({ ...l, via: 'link' }))])
  const translatedMedia = await translationMediaIds(db, e, id)
  const seenBefore = await changeSnapshot(e, id)
  const deleted: any[] = await (db as any).delete(e.table).where(both(both(eq(e.table.id, id), rowFilter), notLiveCond(e, user))).returning()
    .catch(async (err: any) => {
      // Still used by other content: say by what, so the editor can go and change it.
      if ((err?.code ?? err?.cause?.code) === '23503') throw await inUse(db, reg, user, await usedBy(db, reg, e, id))
      return rethrowDbError(err, e, 'delete')
    })
  if (!deleted.length) throw createError({ statusCode: 404, statusMessage: 'Not found or not permitted' })

  // GC media the deleted row owned, once nothing else references it.
  const storage = useCmsStorage()
  for (const mediaId of new Set([...mediaIdsOf(reg, e, deleted[0]), ...translatedMedia])) {
    await gcMediaIfOrphan(db, reg, storage, mediaId, gcScope(user))
  }
  await audit(event, 'entry.delete', { entity: e.name, recordId: id })
  await dropCollabDocuments(e.name, id)
  await dropRevisions(e, id)
  await reportChange(event, { type: 'entry.deleted', entity: e, id, before: seenBefore })
  return { ok: true }
})
