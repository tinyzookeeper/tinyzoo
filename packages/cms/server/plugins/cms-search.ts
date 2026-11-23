// The search index: once the database is migrated, rebuild it if it was built from
// another configuration (a new site, an upgrade, a changed cms.config.ts). In the
// background — the server answers meanwhile, searching the old index.
export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  onCmsSiteStart(() => {
    cmsMigrationsReady()
      .then(() => ensureSearchIndex())
      .catch((err) => {
        const hint = missingTableHint(err)
        console.error(`[cms] could not build the search index${hint ? ` — ${hint}` : ''}`, scrubError(err))
      })
  })
})
