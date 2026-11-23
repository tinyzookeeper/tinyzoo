// Migrate the database when the server starts, if enabled (cms.migrations.onStart /
// NUXT_CMS_MIGRATIONS_ON_START=true). API requests wait for it (cms-migrate-gate).
// Multi-tenant mode: each site's database, when the site is first used or the sweep after start reaches it.
export default defineNitroPlugin(() => {
  if ((useRuntimeConfig().cms as any)?.migrations?.onStart) onSiteStart(() => startCmsMigrations())
})
