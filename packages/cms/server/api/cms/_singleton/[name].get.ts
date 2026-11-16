// GET /api/cms/_singleton/:name — the single row of a global (or null if not yet
// saved), shaped for the admin form. `_singleton` is underscore-prefixed so it wins
// static routing over /api/cms/[entity].
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'name'))
  if (!e.singleton) throw createError({ statusCode: 404, statusMessage: `Not a global: ${e.name}` })
  const where = authorize(e, 'read', user)

  const [row] = await db.select().from(e.table).where(where).orderBy(e.table.createdAt).limit(1)
  if (row) {
    await hydrateRowForForm(db, reg, e, row)
    const locale = requestedLocale(event, reg)
    if (isTranslationLocale(reg, locale) && e.localized.length) await translationFormRow(db, reg, e, row, locale)
    if (reg.locales && e.localized.length) row.__locales = (await availableLocales(db, reg, e, [row.id])).get(row.id)
  }
  return { row: row ?? null, can: await updateVerdict(db, e, user, null) }
})
