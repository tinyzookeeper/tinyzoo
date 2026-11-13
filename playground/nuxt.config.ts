export default defineNuxtConfig({
  // The whole CMS (admin pages, components, server API and its module), by package
  // name — exactly as a client app installs it.
  extends: ['@my-cms/core/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  // @my-cms/client ships TS source; let Vite transpile it (no build step in-repo).
  build: { transpile: ['@my-cms/client'] },
  css: ['~/assets/css/main.css'],
  // The database comes from DATABASE_URL at runtime (playground/.env in development).
  devtools: { enabled: false },
  compatibilityDate: '2025-06-01',
})
