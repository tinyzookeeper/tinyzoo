// The home page is the page with the address "home", but the website shows it at / (and /en):
// that is the address the sitemap lists (/home and /en/home only redirect there).
export default defineNitroPlugin((nitro) => {
  const home = (loc: string) => loc.replace(/^((?:\/[a-z]{2})?)\/home$/, '$1') || '/'
  nitro.hooks.hook('cms:sitemap', (entries) => {
    for (const e of entries) {
      e.loc = home(e.loc)
      e.alternates = e.alternates.map((a) => ({ ...a, loc: home(a.loc) }))
    }
  })
})
