// tinyzoo's /sitemap.xml, the way the website shows its addresses: each language's home
// page is at /, /en, /de (the content address /home only redirects there), and the
// changelog's own page (/novinky, /en/news, /de/neuigkeiten) is listed too, and so is the
// documentation (rendered from docs/ at build time, see modules/docs).
import { LANGS, NEWS_SEGMENT, localePath } from '../../app/lib/site-i18n'
import { DOCS_SECTIONS, docsPath, type DocsNav } from '../../shared/docs'

export default defineNitroPlugin((nitro) => {
  const home = (loc: string) => loc.replace(/\/home$/, '') || '/'
  nitro.hooks.hook('cms:sitemap', async (entries) => {
    for (const e of entries) {
      e.loc = home(e.loc)
      e.alternates = e.alternates.map((a) => ({ ...a, loc: home(a.loc) }))
    }
    const news = LANGS.map((l) => ({ locale: l, loc: localePath(`/${NEWS_SEGMENT[l]}`, l) }))
    for (const n of news) entries.push({ loc: n.loc, locale: n.locale, lastmod: null, alternates: news })

    // The documentation: the same page in each language pairs up by its place in the contents.
    const navs = (await Promise.all(LANGS.map((l) => docsNav(l)))).filter(Boolean) as DocsNav[]
    if (navs.length !== LANGS.length) return
    const sets: { locale: string; loc: string }[][] = [LANGS.map((l) => ({ locale: l, loc: docsPath(l) }))]
    for (const section of DOCS_SECTIONS) {
      sets.push(LANGS.map((l) => ({ locale: l, loc: docsPath(l, section) })))
      const pages = navs.map((n) => n.sections[section].groups.flatMap((g) => g.pages))
      pages[0]!.forEach((_, i) => sets.push(LANGS.map((l, j) => ({ locale: l, loc: pages[j]![i]?.path ?? docsPath(l, section) }))))
    }
    for (const set of sets) for (const a of set) entries.push({ loc: a.loc, locale: a.locale, lastmod: null, alternates: set })
  })
})
