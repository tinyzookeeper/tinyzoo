// /robots.txt: everything may be crawled except the admin, and the sitemap is announced.
// The sitemap's address needs the site's own: cms.publicUrl (NUXT_CMS_PUBLIC_URL).
export default defineEventHandler((event) => {
  const lines = ['User-agent: *', 'Disallow: /admin', '']
  const cms = useRuntimeConfig(event).cms as { content?: { token?: string } } | undefined
  const base = siteBase(event)
  // A private content API (content token) has no public sitemap.
  if (base && !cms?.content?.token) lines.push(`Sitemap: ${base}/sitemap.xml`, '')
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return lines.join('\n')
})
