// The part of the template kit a website uses at run time, as a Nuxt layer:
//
//   extends: ['tinyzoo-template-kit/layer', 'tinyzoo/layer']   (the kit first: it stands over tinyzoo's defaults)
//
// It brings the website's frame, the same in every template: the pages (/, every other
// address), the layout with the look's header and footer, the error page, robots.txt and the
// sitemap's home address; `useSite`, `useSitePage` and `useSiteList` (the settings, the page,
// a collection); <LookPart> (a part drawn by the site's look) and `useLookHead` (the look and
// its colours onto <html>); `useSiteForm` (a website form without markup, so each look draws
// its own); <KitMarked> (a heading with one *marked* part) and the small helpers for
// addresses, prices and dates. Looks themselves are plain data: `tinyzoo-template-kit/looks`.
//
// A template brings the rest: its content model, looks.ts, the generated client, its words
// and `ENTRY_PAGES` (app/utils/site.ts), one stylesheet and one folder of components per look.
//
// In the kit's own files `~` and `~~` are the kit's folders, so the template's files are named
// `#site/…` (its root: `#site/looks`, `#site/app/lib/cms-content`).
export default defineNuxtConfig({
  modules: [
    function templateKit(_options, nuxt) {
      nuxt.options.alias['#site'] = nuxt.options.rootDir
    },
  ],
})
