// How a site adds addresses that come from data to /sitemap.xml: push entries from the
// `cms:sitemap` hook (it runs when the sitemap is built, at most once a minute). Here it is
// a fixed one, so the API tests can see the hook run.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cms:sitemap', (entries) => {
    entries.push({ loc: '/z-hooku', locale: null, lastmod: null, alternates: [] })
  })
})
