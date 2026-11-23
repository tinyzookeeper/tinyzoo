import { emitContentTypes } from 'tinyzoo'
// virtual alias provided by the module (build-time); typed through the host's tsconfig paths
import * as cmsConfig from '#cms/config'

// GET /api/content-types.ts — the generated, strictly-typed @tinyzoo/client
// bindings for this CMS. A separate frontend can `curl` it straight into its src:
//   curl https://cms.example.com/api/content-types.ts -o src/cms-content.ts
// Pure function of the immutable config → built once and cached.
const cached = cmsProcessWide<{ text?: string }>({}, 'generated from the content model, the same for every site')

export default defineEventHandler((event) => {
  assertContentAuth(event)
  cached.text ??= emitContentTypes(cmsConfig as Record<string, any>)
  setContentCache(event)
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return cached.text
})
