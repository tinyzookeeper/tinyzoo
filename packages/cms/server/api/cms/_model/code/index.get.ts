// GET /api/cms/_model/code — the code registered against the site's own content types:
// { registrations: [{ name, registeredAt, updatedAt, source, by, version, types, breaks }] }, by
// name, each with what the site lacks now of what it reads (`types` and `breaks` are null for a
// stored file this tinyzoo cannot read). An administrator signed in, or an access token with the
// right "Content types"; 404 when the feature is off for the site.
export default defineEventHandler(async (event) => {
  await requireModelCaller(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { registrations: await cmsModelCodeList() }
})
