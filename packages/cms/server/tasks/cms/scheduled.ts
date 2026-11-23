// Scheduled publishing: entries whose publish date has just come are live already
// (every visibility check compares the date). This task tells the world: it reports
// them as published — webhooks (site cache), live updates, the cms:change hook.
export default defineTask({
  meta: { name: 'cms:scheduled', description: 'Announce scheduled entries that went live' },
  async run() {
    // Outside a request there is no site: run it in each (one site in single mode).
    let announced = 0
    await runReportedTask('cms:scheduled', async () => {
      await forEachSite(async () => { announced += (await announceScheduled()) ?? 0 }, { concurrency: 5, what: 'scheduled publishing' })
    })
    return { result: { announced } }
  },
})
