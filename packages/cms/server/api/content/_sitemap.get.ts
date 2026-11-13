// GET /api/content/_sitemap — the site's public addresses as JSON (for frontends that
// build their own sitemap or a static export). Same data as /sitemap.xml.
export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  setContentCache(event)
  return { entries: await sitemapEntries(db, reg) }
})
