// A website with its CMS inside: the admin lives at /admin, the content API at
// /api/content, and your pages read from it. See README.md.
export default defineNuxtConfig({
  extends: ['tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client'] },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  compatibilityDate: '2025-06-01',
})
