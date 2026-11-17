// A website with its CMS inside: the admin lives at /admin, the content API at
// /api/content, and your pages read from it. See README.md.
export default defineNuxtConfig({
  extends: ['tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client'] },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  // #if news
  // Addresses that are not entries but belong in /sitemap.xml: the news list, in each language.
  // The pages and news items are added by the CMS (the home page as / and /en: server/plugins/sitemap.ts).
  cms: { sitemap: { paths: [{ cs: '/aktuality', en: '/en/news' }] } },
  // #endif
  compatibilityDate: '2025-06-01',
})
