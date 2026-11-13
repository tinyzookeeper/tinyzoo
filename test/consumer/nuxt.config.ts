// A client app as it would look outside this repo: the CMS comes from the packed
// tarballs (scripts/consumer-check.mjs), loaded by package name.
export default defineNuxtConfig({
  extends: ['tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client'] },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-06-01',
  devtools: { enabled: false },
})
