// tinyzoo's /sitemap.xml, the way the website shows its addresses: each language's home
// page is at /, /en, /de (the content address /home only redirects there), and the
// changelog's own page (/novinky, /en/news, /de/neuigkeiten) is listed too.
import { LANGS, NEWS_SEGMENT, localePath } from '../../app/lib/site-i18n'

export default defineNitroPlugin((nitro) => {
  const home = (loc: string) => loc.replace(/\/home$/, '') || '/'
  nitro.hooks.hook('cms:sitemap', (entries) => {
    for (const e of entries) {
      e.loc = home(e.loc)
      e.alternates = e.alternates.map((a) => ({ ...a, loc: home(a.loc) }))
    }
    const news = LANGS.map((l) => ({ locale: l, loc: localePath(`/${NEWS_SEGMENT[l]}`, l) }))
    for (const n of news) entries.push({ loc: n.loc, locale: n.locale, lastmod: null, alternates: news })
  })
})
