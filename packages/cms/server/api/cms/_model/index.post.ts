import { z } from 'zod'

// POST /api/cms/_model { baseVersion, ops, dryRun? } — change the site's own content types
// through the structure function (cmsModelChange.ts), which checks the operations themselves.
// Administrators only; 404 when the feature is off for the site.
const body = z.strictObject({
  baseVersion: z.number().int().min(0),
  ops: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
  dryRun: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  requireCustomTypes()
  requireCmsAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const input = parseOr422(body, await readBody(event))
  return cmsChangeModel(event, { baseVersion: input.baseVersion, ops: input.ops as any, dryRun: input.dryRun })
})
