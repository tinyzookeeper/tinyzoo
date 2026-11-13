// GET /api/content/_global/:name — the single object of a public global (or null).
// Singletons are served here, not via the collection list/slug routes.
export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const e = getPublicEntity(reg, getRouterParam(event, 'name')) // 404 unless content.public
  if (!e.singleton) throw createError({ statusCode: 404, statusMessage: `No public global: ${e.name}` })

  const locale = requestedLocale(event, reg)
  const [row] = await db.select().from(e.table).orderBy(e.table.createdAt).limit(1)
  setContentCache(event)
  if (!row) return { item: null }
  await overlayTranslations(db, reg, e, [row], locale)
  await populateItems(db, reg, e, [row], e.content?.populate, locale)
  const item = projectItem(e, row)
  await attachLocaleInfo(db, reg, e, [row], [item], locale)
  return { item }
})
