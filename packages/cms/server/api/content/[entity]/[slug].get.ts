import { and, eq } from 'tinyzoo'

// GET /api/content/:entity/:slug — a single PUBLISHED item by its slug field
// (falling back to id). 404 for missing OR unpublished (never reveal drafts).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const e = getPublicEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Use /api/content/_global/:name' })
  const key = getRouterParam(event, 'slug')!
  const locale = requestedLocale(event, reg)

  // Authorized preview (admin session or content token + ?preview) bypasses the
  // published filter so editors can see drafts; everyone else only sees published.
  const preview = isPreviewAuthorized(event)
  // A signed-in preview sees drafts — but only rows that person may read.
  const previewRows = preview && event.context?.cmsUser ? accessWhere(e, 'read', event.context.cmsUser) : null
  const published = !preview ? publishedCond(e) : previewRows ? (previewRows.allowed ? previewRows.where : publishedCond(e)) : undefined
  const guard = (col: any, val: string) => (published ? and(published, eq(col, val)) : eq(col, val))

  let row: any
  const slugField = e.content?.slug
  // A translated URL address first (e.g. /en/christmas-cookies), then the default one.
  if (slugField && isTranslationLocale(reg, locale) && e.localized.includes(slugField) && e.localesTable) {
    const t = e.localesTable
    const [tr] = await db.select({ parentId: t.parentId }).from(t).where(and(eq(t.locale, locale), eq(t[slugField], key)))
    if (tr) [row] = await db.select().from(e.table).where(guard(e.table.id, tr.parentId))
  }
  if (!row && slugField && e.table[slugField]) {
    ;[row] = await db.select().from(e.table).where(guard(e.table[slugField], key))
  }
  if (!row && UUID.test(key)) {
    ;[row] = await db.select().from(e.table).where(guard(e.table.id, key))
  }
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await overlayTranslations(db, reg, e, [row], locale)
  // The editor's unsaved values, while they type (live preview).
  applyPreviewDrafts(event, reg, e, [row], locale)
  await populateItems(db, reg, e, [row], e.content?.populate, locale)
  // Never let a draft preview be cached by a shared/browser cache.
  if (preview) setResponseHeader(event, 'Cache-Control', 'private, no-store')
  else setContentCache(event)
  const item = projectItem(e, row)
  await attachLocaleInfo(db, reg, e, [row], [item], locale)
  return { item, ...(preview ? { preview: true } : {}) }
})
