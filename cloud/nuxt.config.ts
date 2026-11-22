// tinyzoo's hosted sign-up: someone makes an account, picks a template, names their site and
// gets a running tinyzoo site with an admin of their own. Same stack and look as Keeper.
// See README.md.
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  // scripts/e2e.mjs and scripts/walkthrough.mjs start a second dev server beside the
  // developer's own; it builds into a folder of its own (CLOUD_BUILD_DIR) so the two do not
  // write over each other.
  ...(process.env.CLOUD_BUILD_DIR ? { buildDir: process.env.CLOUD_BUILD_DIR } : {}),
  modules: ['@nuxt/ui', '@nuxt/fonts', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  app: {
    head: {
      title: 'tinyzoo',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  fonts: {
    families: [
      { name: 'Manrope', provider: 'google', weights: [500, 600, 700, 800] },
      { name: 'Inter', provider: 'google', weights: [400, 500, 600] },
      { name: 'Geist Mono', provider: 'google', weights: [400, 500] },
    ],
  },
  runtimeConfig: {
    // NUXT_DATABASE_URL (or DATABASE_URL).
    databaseUrl: '',
    // NUXT_CLOUD_SECRET: encrypts what is kept about each site (its secrets, the invitation link). 32+ characters.
    cloudSecret: '',
    // NUXT_PUBLIC_URL: the cloud's own address, for links in e-mails.
    publicUrl: '',
    // NUXT_MIGRATIONS_DIR: a folder of SQL migrations to use instead of the bundled ones.
    migrationsDir: '',
    // NUXT_MAX_SITES_PER_USER
    maxSitesPerUser: 3,
    // NUXT_REQUIRE_VERIFIED_EMAIL: 'true' | 'false'; empty = false in development, true in production.
    requireVerifiedEmail: '',
    // NUXT_SERVICE_EMAIL: the account the cloud keeps on every site, to act on it later.
    serviceEmail: 'cloud@tinyzoo.invalid',
    hosting: {
      // NUXT_HOSTING_DRIVER: local | pushbase
      driver: 'local',
      local: {
        // NUXT_HOSTING_LOCAL_PORT_FROM / _TO: one port per website.
        portFrom: 4300,
        portTo: 4399,
        // NUXT_HOSTING_LOCAL_ROOT: the repository's root (templates are found from it). Default: found from the working directory.
        root: '',
        // NUXT_HOSTING_LOCAL_DATA_DIR: where the websites' folders live. Default: <cloud>/.data/sites.
        dataDir: '',
      },
      pushbase: {
        // NUXT_HOSTING_PUSHBASE_TEMPLATES_DIR: a folder with one standalone project per template (<dir>/<template id>).
        templatesDir: '',
        // NUXT_HOSTING_PUSHBASE_DATABASE: the workspace's shared Postgres service to link each site to.
        database: '',
        // NUXT_HOSTING_PUSHBASE_TEAM: the team new projects are filed under, when the workspace asks for one.
        team: '',
      },
    },
    // The sign-in cookie's own name: on localhost cookies are shared across ports, and the
    // websites use nuxt-auth-utils' default name.
    session: { name: 'tinyzoo-cloud', maxAge: 60 * 60 * 24 * 30 },
    mail: {
      // NUXT_MAIL_TRANSPORT: 'smtp' sends, 'log' only prints e-mails (in development the page shows the link instead).
      transport: 'log',
      from: '',
      smtp: { host: '', port: 587, secure: false, requireTls: false, tlsRejectUnauthorized: true, user: '', pass: '', name: '' },
    },
    public: {
      // NUXT_PUBLIC_SHOW_PLANNED: 'true' shows the planned templates in the gallery, marked as not available.
      showPlanned: '',
    },
  },
  nitro: {
    // The SQL migrations ship inside the server build (server/plugins/0.migrate.ts).
    serverAssets: [{ baseName: 'cloud-migrations', dir: './server/db/migrations' }],
  },
})
