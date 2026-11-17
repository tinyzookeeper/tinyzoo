// /sitemap.xml is @nuxtjs/sitemap's (installed with tinyzoo, see module.ts). tinyzoo gives it:
//  - the entries: every published item at its website address in each language, with
//    hreflang alternates (and x-default: the default language), cms.sitemap.paths and
//    what the cms:sitemap hook adds — the same list as /api/content/_sitemap;
//  - the site's address: NUXT_CMS_PUBLIC_URL, unless the site config sets one
//    (NUXT_SITE_URL or `site.url`). In production a sitemap needs one of them and is a 404
//    without (server/middleware/cms-sitemap-address.ts).
// A private content API (NUXT_CMS_CONTENT_TOKEN) keeps its entries out of the sitemap.
// The module does the rest: the XML, leaving out what robots rules keep from search
// engines, splitting a large sitemap, and a readable view in the browser.

/** Below the site config (nuxt.config `site`, NUXT_SITE_URL), above the request's own address. */
const PUBLIC_URL_PRIORITY = -3.5

interface SitemapUrl { loc: string; lastmod?: string; alternatives?: { hreflang: string; href: string }[] }

export default defineNitroPlugin((nitro) => {
  const hooks = nitro.hooks as any

  hooks.hook('site-config:init', ({ siteConfig }: { siteConfig: { push: (c: Record<string, unknown>) => void } }) => {
    const url = String((useRuntimeConfig().cms as any)?.publicUrl || '').trim()
    if (url) siteConfig.push({ _context: 'tinyzoo:publicUrl', _priority: PUBLIC_URL_PRIORITY, url })
  })

  hooks.hook('sitemap:input', async (ctx: { urls: SitemapUrl[] }) => {
    if ((useRuntimeConfig().cms as any)?.content?.token) return
    const { db, reg } = useCms()
    const fallback = reg.locales?.default ?? null
    for (const e of await sitemapEntries(db, reg)) {
      const url: SitemapUrl = { loc: e.loc }
      if (e.lastmod) url.lastmod = e.lastmod
      // The versions point at each other (itself included); one version alone has nothing to say.
      if (e.alternates.length > 1) {
        url.alternatives = e.alternates.map((a) => ({ hreflang: a.locale, href: a.loc }))
        const def = e.alternates.find((a) => a.locale === fallback) ?? e.alternates[0]!
        url.alternatives.push({ hreflang: 'x-default', href: def.loc })
      }
      ctx.urls.push(url)
    }
  })
})
