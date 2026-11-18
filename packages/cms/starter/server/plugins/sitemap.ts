// The home page is the page with the address "home", but the website shows it at / (and /en):
// that is the address the sitemap lists (/home and /en/home only redirect there).
import { siteHref } from '../../app/utils/site'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cms:sitemap', (entries) => {
    for (const e of entries) {
      e.loc = siteHref(e.loc)
      e.alternates = e.alternates.map((a) => ({ ...a, loc: siteHref(a.loc) }))
    }
  })
})
