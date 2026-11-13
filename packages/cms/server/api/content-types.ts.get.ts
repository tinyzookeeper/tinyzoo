import { emitContentTypes } from 'tinyzoo'
// virtual alias provided by the module (build-time); typed through the host's tsconfig paths
import * as cmsConfig from '#cms/config'

// GET /api/content-types.ts — the generated, strictly-typed @tinyzoo/client
// bindings for this CMS. A separate frontend can `curl` it straight into its src:
//   curl https://cms.example.com/api/content-types.ts -o src/cms-content.ts
// Pure function of the immutable config → built once and cached.
let cached: string | undefined

export default defineEventHandler((event) => {
  assertContentAuth(event)
  if (cached === undefined) cached = emitContentTypes(cmsConfig as Record<string, any>)
  setContentCache(event)
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return cached
})
