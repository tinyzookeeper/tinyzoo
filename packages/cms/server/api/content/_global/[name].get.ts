// GET /api/content/_global/:name — the single object of a public global (or null).
// Singletons are served here, not via the collection list/slug routes.
export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const e = getPublicEntity(reg, getRouterParam(event, 'name')) // 404 unless content.public
  if (!e.singleton) throw createError({ statusCode: 404, statusMessage: `No public global: ${e.name}` })

  const locale = requestedLocale(event, reg)
  const [row] = await db.select().from(e.table).orderBy(e.table.createdAt).limit(1)
  if (!row) {
    setContentCache(event)
    return { item: null }
  }
  await overlayTranslations(db, reg, e, [row], locale)
  // The editor's unsaved values, while they type (live preview).
  applyPreviewDrafts(event, reg, e, [row], locale)
  setContentCache(event)
  await populateItems(db, reg, e, [row], e.content?.populate, locale, { preview: isPreviewAuthorized(event), user: event.context?.cmsUser })
  const item = projectItem(e, row)
  stripForPreviewer(event, e, [item])
  await attachLocaleInfo(db, reg, e, [row], [item], locale)
  return { item }
})
