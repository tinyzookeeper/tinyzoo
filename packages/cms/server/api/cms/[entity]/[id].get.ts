import { eq } from 'tinyzoo'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'read', user)
  const id = getIdParam(event)

  const [row] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await hydrateRowForForm(db, reg, e, row)
  // ?locale=<translation>: the translation itself (empty where missing) plus the
  // default-language values for reference.
  const locale = requestedLocale(event, reg)
  if (isTranslationLocale(reg, locale) && e.localized.length) await translationFormRow(db, reg, e, row, locale)
  if (reg.locales && e.localized.length) row.__locales = (await availableLocales(db, reg, e, [id])).get(id)
  // Whether this person may save here (the form opens read-only when not).
  return { row: stripUnreadable(e, user, row), can: await updateVerdict(db, e, user, id) }
})
