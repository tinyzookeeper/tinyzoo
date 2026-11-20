// Keeper: one overview of every tinyzoo site you look after — whether each is up, which
// tinyzoo it runs, how its client uses it — with a way into each admin. Self-hosted for
// now (one workspace); the tables already carry the workspace, for a hosted version later.
// See README.md.
//
// It is also a Nuxt layer: a deployment of Keeper is a small app with
// `extends: ['tinyzoo-keeper']` (our own is ~/Coding/VSCodeProjects/keeper). Paths
// here are relative to this file, never `~`, which would mean the extending app.
import { fileURLToPath } from 'node:url'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

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
      // NUXT_MAIL_TRANSPORT: 'smtp' or 'log' (prints e-mails).
      transport: 'log',
      from: '',
      smtp: { host: '', port: 587, secure: false, user: '', pass: '' },
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
