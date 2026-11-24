import { emptyModelDoc } from 'tinyzoo'

// GET /api/cms/_model — the site's own content types, for the structure editor (experimental;
// cmsCustomTypes.ts): the document with its hidden things, what the instance could not build,
// the limits and how much of them is used, the design's types (read-only, and the targets a
// relation may point at) and how many entries each custom type has. Administrators only; 404
// when the feature is off for the site.
export default defineEventHandler(async (event) => {
  // Signed in first (401), as every admin route; then the route exists only with the feature on (404), and is for administrators (403).
  requireCmsUser(event)
  const { limits } = requireCustomTypes()
  requireCmsAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const part = cmsLoadedCustomPart()
  const doc = part?.doc ?? emptyModelDoc()
  return {
    version: part?.version ?? 0,
    doc,
    problems: part?.problems ?? [],
    limits,
    used: { types: doc.types.length },
    design: describeDesignTypes(cmsDesignModel().reg),
    entries: await countModelEntries(part?.doc ?? null),
  }
})
