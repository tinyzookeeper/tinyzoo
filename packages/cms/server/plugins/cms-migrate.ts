// Migrate the database when the server starts, if enabled (cms.migrations.onStart /
// NUXT_CMS_MIGRATIONS_ON_START=true). API requests wait for it (cms-migrate-gate).
export default defineNitroPlugin(() => {
  if ((useRuntimeConfig().cms as any)?.migrations?.onStart) startCmsMigrations()
})
