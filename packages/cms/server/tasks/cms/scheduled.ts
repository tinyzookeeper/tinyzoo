// Scheduled publishing: entries whose publish date has just come are live already
// (every visibility check compares the date). This task tells the world: it reports
// them as published — webhooks (site cache), live updates, the cms:change hook.
//
// Multi-tenant mode: it runs only in the sites that may have something due (see
// cmsScheduler.ts: what a site's next due time is, what clears it, the slow rotation).
export default defineTask({
  meta: { name: 'cms:scheduled', description: 'Announce scheduled entries that went live' },
  async run() {
    // Outside a request there is no site: run it in each (one site in single mode).
    let announced = 0
    const sites = { looked: 0, skipped: 0, failed: 0 }
    await runReportedTask('cms:scheduled', async () => {
      if (!cmsIsMultiTenant()) {
        await forEachCmsSite(async () => { announced += (await announceScheduled()) ?? 0 }, { concurrency: 5, what: 'scheduled publishing' })
        return
      }
      // A site with its own content types reads them first, as a request would (at once with the feature off).
      Object.assign(sites, await runInDueSites('scheduled publishing', scheduledWorkMayBeDue, async () => { announced += (await cmsAfterSiteReady(() => announceScheduled({ remember: true }))) ?? 0 }))
    })
    const result: Record<string, number> = { announced }
    if (!cmsIsMultiTenant()) return { result }
    const { looked, skipped, failed } = sites
    if (looked) console.debug(`[cms] scheduled: looked at ${looked} site(s), skipped ${skipped}${failed ? `, ${failed} failed` : ''}, ${announced} announced`)
    return { result: { ...result, looked, skipped, failed } }
  },
})
