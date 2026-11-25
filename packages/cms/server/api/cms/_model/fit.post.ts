import { z } from 'zod'

// POST /api/cms/_model/fit { file } — would code built from this model file work against the site
// now? { version, fits, breaks }: `breaks` is what the site lacks of what the file reads
// (`modelMisfits`). Changes nothing. 422 `invalid-file` for a file that does not read. An
// administrator signed in, or an access token with the right "Content types"; 404 when the
// feature is off for the site.
const body = z.strictObject({ file: z.unknown() })

export default defineEventHandler(async (event) => {
  await requireModelCaller(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const input = parseOr422(body, await readBody(event))
  return cmsModelFit(input.file)
})
