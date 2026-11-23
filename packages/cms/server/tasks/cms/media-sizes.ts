// Smaller copies of pictures: make the ones that are missing — pictures uploaded on another
// instance, uploaded before copies were made at upload, or wanting a width added since (see
// server/utils/cmsImageSizes.ts). Runs every minute; an upload starts it at once too.
// `npx nitro task run cms:media-sizes` runs it by hand.
export default defineTask({
  meta: { name: 'cms:media-sizes', description: 'Make the missing smaller copies of pictures' },
  async run() {
    // Outside a request there is no site: run it in each (one site in single mode).
    let pictures = 0
    await runReportedTask('cms:media-sizes', async () => {
      await forEachCmsSite(async () => { pictures += (await runMediaSizes()) ?? 0 }, { concurrency: 5, what: 'smaller copies of pictures' })
    })
    return { result: { pictures } }
  },
})
