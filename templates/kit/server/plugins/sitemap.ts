// The home page is the page with the address "home", but the website shows it at /: that is
// the address the sitemap lists (/home only redirects there).
import { siteHref } from '../../app/utils/format'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cms:sitemap', (entries) => {
    for (const e of entries) {
      e.loc = siteHref(e.loc)
      e.alternates = e.alternates.map((a) => ({ ...a, loc: siteHref(a.loc) }))
    }
  })
})
