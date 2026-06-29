import { and, eq } from '@my-cms/core'

// GET /api/content/:entity/:slug — a single PUBLISHED item by its slug field
// (falling back to id). 404 for missing OR unpublished (never reveal drafts).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const e = getPublicEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Use /api/content/_global/:name' })
  const key = getRouterParam(event, 'slug')!

  // Authorized preview (admin session or content token + ?preview) bypasses the
  // published filter so editors can see drafts; everyone else only sees published.
  const preview = isPreviewAuthorized(event)
  const published = preview ? undefined : publishedCond(e)
  const guard = (col: any, val: string) => (published ? and(published, eq(col, val)) : eq(col, val))

  let row: any
  const slugField = e.content?.slug
  if (slugField && e.table[slugField]) {
    ;[row] = await db.select().from(e.table).where(guard(e.table[slugField], key))
  }
  if (!row && UUID.test(key)) {
    ;[row] = await db.select().from(e.table).where(guard(e.table.id, key))
  }
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await populateItems(db, reg, e, [row], e.content?.populate)
  // Never let a draft preview be cached by a shared/browser cache.
  if (preview) setResponseHeader(event, 'Cache-Control', 'private, no-store')
  else setContentCache(event)
  return { item: projectItem(e, row), ...(preview ? { preview: true } : {}) }
})
