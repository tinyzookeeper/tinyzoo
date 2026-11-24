// Keeper: one overview of every tinyzoo site you look after — whether each is up, which
// tinyzoo it runs, how its client uses it — with a way into each admin. Self-hosted, with
// workspaces and teams as in Postyard (/w/<workspace>/t/<team>); a hosted version comes later.
// See README.md.
//
// It is also a Nuxt layer: a deployment of Keeper is a small app with
// `extends: ['tinyzoo-keeper']` (our own is ~/Coding/VSCodeProjects/keeper). Paths
// here are relative to this file, never `~`, which would mean the extending app.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
// Keeper's own version (this layer's, not the extending app's) and when this build was made:
// Settings → About shows both.
const { version } = JSON.parse(readFileSync(here('./package.json'), 'utf8')) as { version: string }

export default defineNuxtConfig({
  $meta: { name: 'keeper' },
  compatibilityDate: '2026-11-01',
  modules: ['@nuxt/ui', '@nuxt/fonts', 'nuxt-auth-utils'],
  css: [here('./app/assets/css/main.css')],
  // Keeper's own types (`#shared` would be the extending app's).
  alias: { '#keeper': here('./shared') },
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Keeper',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
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
    // NUXT_KEEPER_SECRET: encrypts the sites' status tokens at rest (32+ characters).
    keeperSecret: '',
    // NUXT_SETUP_TOKEN: asked for when the first account is made (required in production).
    setupToken: '',
    // NUXT_PUBLIC_URL: Keeper's own address, for links in alert e-mails.
    publicUrl: '',
    // NUXT_REDIRECT_HOSTS: host names Keeper used to be reached at, separated by commas. Pages
    // asked for there are redirected to NUXT_PUBLIC_URL (server/middleware/hosts.ts).
    redirectHosts: '',
    // NUXT_MIGRATIONS_DIR: a folder of SQL migrations to use instead of the bundled ones.
    migrationsDir: '',
    checks: {
      // NUXT_CHECKS_DOWN_AFTER: failed checks in a row before a site counts as down.
      downAfter: 2,
      // NUXT_CHECKS_TIMEOUT_MS
      timeoutMs: 10_000,
      // NUXT_CHECKS_STATUS_EVERY_MIN: how often the status (versions, counts) is read.
      statusEveryMin: 5,
      // NUXT_CHECKS_KEEP_DAYS: how long single checks are kept.
      keepDays: 90,
    },
    mail: {
      // NUXT_MAIL_TRANSPORT: 'smtp' sends, 'log' only prints e-mails (invitations then show
      // their link to copy instead).
      transport: 'log',
      // NUXT_MAIL_FROM: the sender, e.g. `Keeper <keeper@example.com>` (default: the SMTP user).
      from: '',
      // NUXT_MAIL_SMTP_*: any SMTP server, e.g. Zimbra: port 587 with REQUIRE_TLS=true
      // (STARTTLS), or 465 with SECURE=true (TLS from the start). TLS_REJECT_UNAUTHORIZED=false
      // accepts a certificate that does not verify (self-signed). NAME: the host name Keeper
      // greets the server with (default: this machine's).
      smtp: { host: '', port: 587, secure: false, requireTls: false, tlsRejectUnauthorized: true, user: '', pass: '', name: '' },
    },
    public: {
      // Set by the build, not meant to be overridden.
      keeper: { version, builtAt: new Date().toISOString() },
    },
  },
  nitro: {
    experimental: { tasks: true },
    // The SQL migrations ship inside the server build (server/plugins/0.migrate.ts).
    serverAssets: [{ baseName: 'keeper-migrations', dir: here('./server/db/migrations') }],
    scheduledTasks: {
      // Uptime every minute (and the status when it is due).
      '* * * * *': ['keeper:checks'],
      // Certificates, the newest release and old checks, twice a day.
      '7 */12 * * *': ['keeper:daily'],
    },
  },
})
