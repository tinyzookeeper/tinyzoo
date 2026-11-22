// Smaller copies of pictures: make the ones that are missing — pictures uploaded on another
// instance, uploaded before copies were made at upload, or wanting a width added since (see
// server/utils/cmsImageSizes.ts). Runs every minute; an upload starts it at once too.
// `npx nitro task run cms:media-sizes` runs it by hand.
export default defineTask({
  meta: { name: 'cms:media-sizes', description: 'Make the missing smaller copies of pictures' },
  async run() {
    const pictures = await runReportedTask('cms:media-sizes', () => runMediaSizes())
    return { result: { pictures } }
  },
})
