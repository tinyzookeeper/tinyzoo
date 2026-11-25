import { z } from 'zod'

// PUT /api/cms/_model/code/<name> { file } — register a model file under a name: code built from
// it runs against the site, so a change of structure that takes away what it reads is refused
// (cmsModelCode.ts). Answers the registration as the list shows it. Refused with 409
// `does-not-fit` (and `breaks`) when the site lacks what the file reads, 422 `invalid-name`,
// `invalid-file` or `limit-code` (10 a site). A name that exists is replaced. An administrator
// signed in, or an access token with the right "Content types"; 404 when the feature is off.
const body = z.strictObject({ file: z.unknown() })

export default defineEventHandler(async (event) => {
  const caller = await requireModelCaller(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const input = parseOr422(body, await readBody(event))
  return cmsRegisterCode(event, { name: getRouterParam(event, 'name') ?? '', file: input.file, source: caller.token ? 'token' : 'session' })
})
