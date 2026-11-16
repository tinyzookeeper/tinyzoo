// The tinyzoo website, built with tinyzoo: the admin lives at /admin, the content
// API at /api/content, and the pages read from it. See README.md.
export default defineNuxtConfig({
  extends: ['tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  build: { transpile: ['@tinyzoo/client'] },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'cs' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/brand/favicon.svg' }],
      meta: [{ name: 'theme-color', content: '#F9F5EF' }],
    },
  },
  runtimeConfig: {
    public: {
      // The demo admin people can try (a separate site, reset every night).
      // NUXT_PUBLIC_DEMO_URL / NUXT_PUBLIC_DEMO_EMAIL / NUXT_PUBLIC_DEMO_PASSWORD
      demo: { url: '', email: '', password: '' },
    },
  },
  // The website's typefaces (the admin adds its own): served from the app, not Google.
  fonts: {
    families: [
      { name: 'Manrope', provider: 'google', weights: [400, 500, 600, 700, 800], global: true },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500], global: true },
    ],
  },
  // Speed: built JS/CSS ship pre-compressed; the brand pictures are cached for a week.
  nitro: { compressPublicAssets: true },
  routeRules: {
    '/animals/**': { headers: { 'cache-control': 'public, max-age=604800, stale-while-revalidate=86400' } },
    '/brand/**': { headers: { 'cache-control': 'public, max-age=604800, stale-while-revalidate=86400' } },
  },
  devtools: { enabled: false },
  compatibilityDate: '2025-06-01',
})
