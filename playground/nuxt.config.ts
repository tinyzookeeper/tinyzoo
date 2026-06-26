export default defineNuxtConfig({
  // Pull in the whole CMS layer (pages/components/server + its module).
  // NB: point at the layer directory, not the package name — the package's
  // `exports` map would otherwise resolve the layer root to src/.
  extends: ['../packages/cms'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  cms: {
    databaseUrl: process.env.DATABASE_URL,
  },
  runtimeConfig: {
    cms: {
      databaseUrl: process.env.DATABASE_URL || 'postgres://cms:cms@localhost:5434/cms',
    },
  },
  devtools: { enabled: false },
  compatibilityDate: '2025-06-01',
})
