// GET /sitemap.xml — every published page and post with a website address
// (`content.path`), with hreflang alternates per language. Absolute URLs use
// cms.publicUrl. A host app can replace it with its own server/routes/sitemap.xml.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;' }[c]!))

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const base = adminLink(event, '')
  const entries = await sitemapEntries(db, reg)
  const urls = entries.map((e) => {
    const alt = e.alternates.length > 1
      ? e.alternates.map((a) => `\n    <xhtml:link rel="alternate" hreflang="${esc(a.locale)}" href="${esc(base + a.loc)}"/>`).join('')
      : ''
    return `  <url>\n    <loc>${esc(base + e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>${alt}\n  </url>`
  })
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
})
