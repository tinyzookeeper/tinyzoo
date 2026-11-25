// GET /api/health/status — a summary of the site for a tool that watches many sites
// (CmsStatus: versions, health, how much it is used; never content or personal data).
// Off (404) until cms.status.token (NUXT_CMS_STATUS_TOKEN) is set; then the request
// carries that token as `x-api-key` or `Authorization: Bearer`.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  await requireCmsStatusToken(event, 'status')
  // A site with its own content types counts them too, once they are read (at once with the feature off).
  // When they cannot be read just now, the status still answers, with the design's types.
  await cmsAfterSiteReady(() => undefined, () => undefined)
  return collectCmsStatus()
})
