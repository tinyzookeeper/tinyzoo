// GET /api/cms/:entity/:id/revisions?locale= — the entry's history (or one
// translation's), newest first. Anyone who may read the entry may see it.
import { eq } from 'tinyzoo'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const id = getIdParam(event)
  const [row] = await db.select({ id: e.table.id }).from(e.table).where(both(eq(e.table.id, id), authorize(e, 'read', user)))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const locale = requestedLocale(event, reg)
  // Which fields a save changed is told only for the fields this person may read.
  const hidden = unreadableFields(e, user)
  const revisions = await listRevisions(e, id, isTranslationLocale(reg, locale) ? locale : null)
  return { revisions: hidden.size ? revisions.map((r: any) => ({ ...r, changed: Array.isArray(r.changed) ? r.changed.filter((k: string) => !hidden.has(k)) : r.changed })) : revisions }
})
