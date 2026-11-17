import { eq } from 'tinyzoo'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'read', user)
  const id = getIdParam(event)

  const [row] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  // Publishing per language: the state of each translation language, from the entry as stored
  // (before a language's own state is laid over it below).
  const states = e.publish?.perLocale ? (await translationStates(db, reg, e, [row])).get(id) : undefined
  await hydrateRowForForm(db, reg, e, row)
  // ?locale=<translation>: the translation itself (empty where missing) plus the
  // default-language values for reference.
  const locale = requestedLocale(event, reg)
  const editingTranslation = isTranslationLocale(reg, locale) && e.localized.length > 0
  if (editingTranslation) await translationFormRow(db, reg, e, row, locale!)
  if (reg.locales && e.localized.length) row.__locales = (await availableLocales(db, reg, e, [id])).get(id)
  if (states) row.__states = states
  // Whether this person may save here (the form opens read-only when not).
  return { row: stripUnreadable(e, user, row), can: await updateVerdict(db, e, user, id, editingTranslation ? locale : null) }
})
