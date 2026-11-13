import { driverKind } from '#cms/db'

// Migrate the database when the server starts, if enabled (cms.migrations.onStart /
// NUXT_CMS_MIGRATIONS_ON_START=true). API requests wait for it (cms-migrate-gate).
// Not on Workers: a Worker may not do I/O while it starts, and it has no single
// start anyway — migrate from CI or a Node process (`pnpm cms up`) instead.
export default defineNitroPlugin(() => {
  if (!(useRuntimeConfig().cms as any)?.migrations?.onStart) return
  if (driverKind === 'edge') {
    console.error('[cms] cms.migrations.onStart is ignored on the edge driver — run migrations from CI or `cms up`')
    return
  }
  startCmsMigrations()
})
