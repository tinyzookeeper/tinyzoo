// tinyzoo's hosted sign-up: someone makes an account, picks a template, names their site and
// gets a running tinyzoo site with an admin of their own. Same stack and look as Keeper.
// See README.md.
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  // scripts/e2e.mjs and scripts/walkthrough.mjs start a second dev server beside the
  // developer's own; it builds into a folder of its own (CLOUD_BUILD_DIR) so the two do not
  // write over each other.
  ...(process.env.CLOUD_BUILD_DIR ? { buildDir: process.env.CLOUD_BUILD_DIR } : {}),
  // The dev server answers only to its own names. CLOUD_DEV_HOSTS (".pushbase.app") adds others:
  // the recorded walkthrough reaches it as https://tinyzoo.pushbase.app, through a proxy of its own.
  ...(process.env.CLOUD_DEV_HOSTS ? { vite: { server: { allowedHosts: process.env.CLOUD_DEV_HOSTS.split(',').map((h) => h.trim()).filter(Boolean) } } } : {}),
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
    // NUXT_PUBLIC_URL: the cloud's own address: for links in e-mails, and the issuer address of
    // sign-in through the account.
    publicUrl: '',
    // NUXT_REDIRECT_HOSTS: host names the app used to be reached at, separated by commas. Pages
    // asked for there, and a sign-in on its way (/oauth/authorize), are redirected to
    // NUXT_PUBLIC_URL (server/middleware/hosts.ts).
    redirectHosts: '',
    // NUXT_RESERVED_SLUGS: names no new website may take, separated by commas, on top of the
    // built-in ones (shared/slug.ts): the names under the sites' domain that lead somewhere else.
    reservedSlugs: '',
    // NUXT_MIGRATIONS_DIR: a folder of SQL migrations to use instead of the bundled ones.
    migrationsDir: '',
    // NUXT_MAX_SITES_PER_USER
    maxSitesPerUser: 3,
    // NUXT_REQUIRE_VERIFIED_EMAIL: 'true' | 'false'; empty = false in development, true in production.
    requireVerifiedEmail: '',
    // NUXT_SERVICE_EMAIL: the account the cloud keeps on every site, to act on it later.
    serviceEmail: 'cloud@tinyzoo.invalid',
    // NUXT_DEV_MAIL_LINKS: 'false' hides the development notes that show an e-mail's link on the page.
    devMailLinks: '',
    // NUXT_ACCOUNT_CODE_TTL_SECONDS: how long a one-time code of a sign-in through the account works.
    // A minute, and never longer; the checks set a shorter time (shared/account.ts).
    accountCodeTtlSeconds: '',
    hosting: {
      // NUXT_HOSTING_DRIVER: local | shared | pushbase, or none (no website is made: the account service alone)
      driver: 'local',
      local: {
        // NUXT_HOSTING_LOCAL_PORT_FROM / _TO: one port per website.
        portFrom: 4300,
        portTo: 4399,
        // NUXT_HOSTING_LOCAL_ROOT: the repository's root (templates are found from it). Default: found from the working directory.
        root: '',
        // NUXT_HOSTING_LOCAL_DATA_DIR: where the websites' folders live. Default: <cloud>/.data/sites.
        dataDir: '',
        // NUXT_HOSTING_LOCAL_DATABASE_PREFIX: what the sites' databases are called before the slug
        // (default tzc_). A second cloud app on the same Postgres server takes another (tzc_e2e_).
        databasePrefix: '',
        // NUXT_HOSTING_LOCAL_PUBLIC_URL: the pattern of the sites' public addresses. Default
        // http://{slug}.localhost:{port}. With another one (https://{slug}.pushbase.app) something
        // in front of the sites must lead those names to their ports (shared/address.ts).
        publicUrl: '',
      },
      // The shared driver: one process per template serves every site made from it (server/hosting/shared.ts).
      shared: {
        // NUXT_HOSTING_SHARED_PORT_FROM / _TO: one port per template, beside the local driver's range.
        portFrom: 4400,
        portTo: 4419,
        // NUXT_HOSTING_SHARED_ROOT: the repository's root (templates are found from it). Default: found from the working directory.
        root: '',
        // NUXT_HOSTING_SHARED_DATA_DIR: where the templates' folders live (the site directory, the sites' uploads). Default: <cloud>/.data/shared.
        dataDir: '',
        // NUXT_HOSTING_SHARED_DATABASE_PREFIX: what the sites' databases and database users are called
        // before the site's id (default tzs). A second cloud app on the same Postgres server takes another.
        databasePrefix: '',
        // NUXT_HOSTING_SHARED_SESSION_COOKIE: another name for the sites' session cookie (e.g. __Host-tinyzoo).
        // Empty: tinyzoo's own default. Read when a template's process is started.
        sessionCookie: '',
        // NUXT_HOSTING_SHARED_DIRECTORY: where the site directory is kept. `file` (default): sites.json in
        // each template's folder. `postgres`: the table tenant_sites in the cloud's own database, read by
        // each template's process with a role that may read that table only.
        directory: 'file',
        // NUXT_HOSTING_SHARED_DIRECTORY_KEY: encrypts every secret in the site directory (32+ characters).
        // Needed for `postgres`; with `file` it is optional, and without it the file holds them in plain text.
        directoryKey: '',
      },
      // NUXT_HOSTING_DOMAIN_TARGET: where a customer's own domain must lead before it is used: a host name
      // (the target of a CNAME) and/or IP addresses, separated by commas.
      domainTarget: '',
      // NUXT_HOSTING_IMPORT_MAX_MB: the largest archive of a website that is taken in (default 2048).
      importMaxMb: '',
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
