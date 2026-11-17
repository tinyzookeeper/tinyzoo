// The tinyzoo website, built with tinyzoo: the admin lives at /admin, the content
// API at /api/content, and the pages read from it. See README.md.
export default defineNuxtConfig({
  extends: ['tinyzoo/layer'],
  modules: [
    '@nuxt/ui',
    'nuxt-auth-utils',
    // Nuxt SEO, module by module (the @nuxtjs/seo bundle brings nuxt-ai-ready, which wants
    // another drizzle-orm): site config, robots.txt + noindex, sharing images, schema.org,
    // canonical links and meta defaults. The sitemap module comes with tinyzoo.
    // Before nuxt-og-image, which looks for @nuxt/fonts when it starts (Nuxt UI only
    // brings it in later): without it the sharing images get Inter without Czech letters.
    '@nuxt/fonts',
    'nuxt-site-config',
    '@nuxtjs/robots',
    'nuxt-og-image',
    'nuxt-schema-org',
    'nuxt-seo-utils',
  ],
  build: { transpile: ['@tinyzoo/client'] },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'cs' },
      // The pages write the whole title ("Plány · tinyzoo"); no " | tinyzoo" from nuxt-seo-utils.
      titleTemplate: '%s',
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
  // The site's address, name and languages, for canonical links, og:url, schema.org and
  // the sharing images. Per deployment: NUXT_SITE_URL, and NUXT_SITE_INDEXABLE=false on the
  // demo (same content as the website): noindex meta, X-Robots-Tag and `Disallow: /`.
  site: {
    url: 'https://tinyzoo.pushbase.app',
    name: 'tinyzoo',
    description: 'tinyzoo je česká administrace pro váš web. Pište články, skládejte stránky a prohlížejte si náhled.',
    defaultLocale: 'cs',
  },
  // /robots.txt: everything but the admin; it names /sitemap.xml by itself.
  robots: {
    disallow: ['/admin'],
  },
  // /sitemap.xml (@nuxtjs/sitemap, with tinyzoo's entries): search results are not pages.
  sitemap: { exclude: ['/hledat', '/en/search', '/de/suche'] },
  // Sharing images, drawn on request from the page's title and description
  // (app/components/OgImage/Tinyzoo.satori.vue) and cached for a day. The image
  // addresses are signed with NUXT_APP_SECRET (32+ characters) in production.
  ogImage: {
    defaults: { width: 1200, height: 630, cacheMaxAgeSeconds: 60 * 60 * 24 },
    // ě š č ř ž ů and ä ö ü ß are in latin-ext.
    fontSubsets: ['latin', 'latin-ext'],
  },
  // The organisation behind the site; every page adds itself as a WebPage of the WebSite.
  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'tinyzoo',
      logo: '/brand/logo-primary.svg',
      sameAs: ['https://github.com/tinyzookeeper/tinyzoo', 'https://www.npmjs.com/package/tinyzoo'],
    },
  },
  // The website's typefaces (the admin adds its own): served from the app, not Google.
  // `global: true` lets the sharing images use them; latin-ext carries the Czech letters.
  fonts: {
    defaults: { subsets: ['latin', 'latin-ext'] },
    families: [
      { name: 'Manrope', provider: 'google', weights: [400, 500, 600, 700, 800], global: true },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500], global: true },
    ],
  },
  // Speed: built JS/CSS ship pre-compressed; the brand pictures are cached for a week.
  // The demo deployment resets itself at 3:00 UTC (server/tasks/site/demo-reset.ts; off unless SITE_DEMO_RESET=true).
  nitro: { compressPublicAssets: true, experimental: { tasks: true }, scheduledTasks: { '0 3 * * *': ['site:demo-reset'] } },
  routeRules: {
    '/animals/**': { headers: { 'cache-control': 'public, max-age=604800, stale-while-revalidate=86400' } },
    '/brand/**': { headers: { 'cache-control': 'public, max-age=604800, stale-while-revalidate=86400' } },
  },
  devtools: { enabled: false },
  compatibilityDate: '2025-06-01',
})
