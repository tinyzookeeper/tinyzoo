// GET /api/cms/_model/file[?version=N] — the site's model file (docs/model-file-plan.md, section 3):
// its visible custom types, the version they were read at and the site's address, written the one
// way (`modelFileOf`). With `version`: the file as it was at that version (0: the empty model), or
// 404 `version-not-kept` when the site no longer keeps it. Read from the database, not from this
// instance's memory. An administrator signed in, or an access token with the right "Content
// types" (requireModelCaller); 404 when the feature is off for the site.
export default defineEventHandler(async (event) => {
  await requireModelCaller(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const asked = getQuery(event).version
  if (asked === undefined) return cmsModelFileAt(null)
  if (typeof asked !== 'string' || !/^\d{1,9}$/.test(asked)) throw createError({ statusCode: 422, statusMessage: 'version: a whole number, 0 or more' })
  return cmsModelFileAt(Number(asked))
})
