// Smaller copies of pictures: make the ones that are missing — pictures uploaded on another
// instance, uploaded before copies were made at upload, or wanting a width added since (see
// server/utils/cmsImageSizes.ts). Runs every minute; an upload starts it at once too.
// `npx nitro task run cms:media-sizes` runs it by hand.
//
// Multi-tenant mode: it runs only in the sites with a reason (an upload here since the last
// run, a run that did not get to the end, the slow rotation); see mediaSizesMayWantRun.
export default defineTask({
  meta: { name: 'cms:media-sizes', description: 'Make the missing smaller copies of pictures' },
  async run() {
    // Outside a request there is no site: run it in each (one site in single mode).
    let pictures = 0
    const sites = { looked: 0, skipped: 0, failed: 0 }
    await runReportedTask('cms:media-sizes', async () => {
      if (!cmsIsMultiTenant()) {
        await forEachCmsSite(async () => { pictures += (await runMediaSizes()) ?? 0 }, { concurrency: 5, what: 'smaller copies of pictures' })
        return
      }
      Object.assign(sites, await runInDueSites('smaller copies of pictures', mediaSizesMayWantRun, async () => { pictures += (await runMediaSizes()) ?? 0 }))
    })
    const result: Record<string, number> = { pictures }
    if (!cmsIsMultiTenant()) return { result }
    const { looked, skipped, failed } = sites
    if (looked) console.debug(`[cms] media sizes: looked at ${looked} site(s), skipped ${skipped}${failed ? `, ${failed} failed` : ''}, ${pictures} picture(s) done`)
    return { result: { ...result, looked, skipped, failed } }
  },
})
