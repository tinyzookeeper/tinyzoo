import { and, eq, indexTree } from 'tinyzoo'

// GET /api/content/:entity/:slug — a single PUBLISHED item by its slug field
// (falling back to id). 404 for missing OR unpublished (never reveal drafts).
// In a page tree the key is the chain of address parts, from the top down, as one path
// segment with the slashes escaped (/api/content/page/o-nas%2Ftym; the client does it):
// the page whose address in the requested language (translated parts, then default) is
// that chain.
// A page under a draft is not reachable: its address runs through the draft.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const e = getPublicEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Use /api/content/_global/:name' })
  const rawKey = getRouterParam(event, 'slug')!
  const key = e.tree ? treeKey(rawKey) : rawKey
  const locale = requestedLocale(event, reg)

  // Authorized preview (admin session or content token + ?preview) bypasses the
  // published filter so editors can see drafts; everyone else only sees published.
  const preview = isPreviewAuthorized(event)
  // A signed-in preview sees drafts — but only rows that person may read.
  const previewRows = preview && event.context?.cmsUser ? accessWhere(e, 'read', event.context.cmsUser) : null
  const published = !preview ? publishedCond(e) : previewRows ? (previewRows.allowed ? previewRows.where : publishedCond(e)) : undefined
  const guard = (col: any, val: string) => (published ? and(published, eq(col, val)) : eq(col, val))
  // Whether this reader sees drafts (an editor's preview) or live pages only.
  const drafts = preview && (previewRows ? previewRows.allowed : true)

  let row: any
  const slugField = e.content?.slug
  if (e.tree && !UUID.test(key)) {
    // Visitors match live pages only: a draft's translated address part must not shadow the live page at that address.
    const node = findByChain(reg, indexTree(await loadTreeNodes(db, reg, e)), key, locale, drafts ? undefined : await liveTreeIds(db, e))
    if (node) [row] = await db.select().from(e.table).where(guard(e.table.id, node.id))
  }
  // A translated URL address first (e.g. /en/christmas-cookies), then the default one.
  if (!e.tree && slugField && isTranslationLocale(reg, locale) && e.localized.includes(slugField) && e.localesTable) {
    const t = e.localesTable
    const [tr] = await db.select({ parentId: t.parentId }).from(t).where(and(eq(t.locale, locale), eq(t[slugField], key)))
    if (tr) [row] = await db.select().from(e.table).where(guard(e.table.id, tr.parentId))
  }
  if (!row && !e.tree && slugField && e.table[slugField]) {
    ;[row] = await db.select().from(e.table).where(guard(e.table[slugField], key))
  }
  if (!row && UUID.test(key)) {
    ;[row] = await db.select().from(e.table).where(guard(e.table.id, key))
  }
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  await overlayTranslations(db, reg, e, [row], locale)
  // The editor's unsaved values, while they type (live preview).
  applyPreviewDrafts(event, reg, e, [row], locale)
  await populateItems(db, reg, e, [row], e.content?.populate, locale, { preview, user: event.context?.cmsUser })
  // Never let a draft preview be cached by a shared/browser cache.
  if (preview) setResponseHeader(event, 'Cache-Control', 'private, no-store')
  else setContentCache(event)
  const item = projectItem(e, row)
  stripForPreviewer(event, e, [item])
  await attachLocaleInfo(db, reg, e, [row], [item], locale)
  await attachTreeInfo(db, reg, e, [row], [item], locale, { drafts })
  return { item, ...(preview ? { preview: true } : {}) }
})

/** The address chain from the route: the escaped slashes (%2F) are the chain's, leading and trailing ones ignored, escapes decoded. */
function treeKey(raw: string): string {
  const parts = raw.split(/\/|%2f/i).filter(Boolean)
  try {
    return parts.map(decodeURIComponent).join('/')
  }
  catch {
    return parts.join('/')
  }
}
