// Rebuild the search index from scratch (normally automatic: on start, when the
// configuration changed, and on every save). `npx nitro task run cms:search-reindex`.
export default defineTask({
  meta: { name: 'cms:search-reindex', description: 'Rebuild the search index' },
  async run() {
    // Outside a request there is no site: run it in each (one site in single mode).
    let rows: number | null = null
    await runReportedTask('cms:search-reindex', async () => {
      await forEachSite(async () => {
        const { db, reg } = useCms()
        const n = await rebuildSearchIndex(db, reg)
        if (n != null) rows = (rows ?? 0) + n
      }, { concurrency: 5, what: 'search reindex' })
    })
    return { result: { rows } }
  },
})
