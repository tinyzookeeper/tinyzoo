/**
 * Timers the built playground runs on a short leash in the tests, so a spec waits for
 * seconds where production waits for half a minute (see server/utils/cmsTiming.ts in the
 * package: read when the server starts, the defaults are what a deploy runs).
 * Every server the API suites start gets these (the shared one and startServer()).
 * Set the variable yourself to try another value (CMS_TEST_COLLAB_HEARTBEAT_MS=30000: production's).
 *
 * The scheduler and retention tasks run on a cron fixed in the build instead: BUILD_CRON
 * (test/setup/build-playground.mjs makes them the `cms.scheduler.cron` and `cms.retention.cron` options).
 */
export const TEST_TIMERS = {
  /** Realtime presence: ping, account re-check (live.spec: a disabled account is cut off on the next beat). Production: 20 s. */
  CMS_TEST_LIVE_HEARTBEAT_MS: process.env.CMS_TEST_LIVE_HEARTBEAT_MS ?? '1000',
  /** Shared editing: connection re-check and "being edited" marks (collab.spec). Production: 30 s. */
  CMS_TEST_COLLAB_HEARTBEAT_MS: process.env.CMS_TEST_COLLAB_HEARTBEAT_MS ?? '1000',
  /** Webhook retries wait this long, then five times as long (ops-server.spec, changes.spec). Production: 1 s, then 5 s. */
  CMS_TEST_WEBHOOK_RETRY_MS: process.env.CMS_TEST_WEBHOOK_RETRY_MS ?? '200',
} as const

/** The scheduled tasks of the test build (cron with seconds): scheduled entries every second, retention every 3 s (production: every minute, daily). */
export const BUILD_CRON = { CMS_TEST_SCHEDULER_CRON: '* * * * * *', CMS_TEST_RETENTION_CRON: '*/3 * * * * *' } as const

/**
 * Secrets in the environment of the test build, each recognisable: a build must not write any
 * of them into `.output` (the app secret is read at start, never at build). start-checks.spec
 * looks for them in the output.
 */
export const BUILD_SECRETS = {
  NUXT_APP_SECRET: 'build-env-app-secret-must-not-be-bundled-4f1c9a',
  NITRO_APP_SECRET: 'build-env-nitro-app-secret-must-not-be-bundled-7b2e',
  NUXT_SESSION_PASSWORD: 'build-env-session-password-must-not-be-bundled-93d0',
} as const
