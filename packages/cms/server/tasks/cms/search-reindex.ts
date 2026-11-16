// Rebuild the search index from scratch (normally automatic: on start, when the
// configuration changed, and on every save). `npx nitro task run cms:search-reindex`.
export default defineTask({
  meta: { name: 'cms:search-reindex', description: 'Rebuild the search index' },
  async run() {
    const { db, reg } = useCms()
    const rows = await rebuildSearchIndex(db, reg)
    return { result: { rows } }
  },
})
