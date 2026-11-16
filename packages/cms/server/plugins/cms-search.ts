// The search index: once the database is migrated, rebuild it if it was built from
// another configuration (a new site, an upgrade, a changed cms.config.ts). In the
// background — the server answers meanwhile, searching the old index.
export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  cmsMigrationsReady()
    .then(() => ensureSearchIndex())
    .catch((err) => console.error('[cms] could not build the search index', scrubError(err)))
})
