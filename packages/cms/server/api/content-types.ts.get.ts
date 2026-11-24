import { emitContentTypes } from 'tinyzoo'

// GET /api/content-types.ts — the generated, strictly-typed @tinyzoo/client
// bindings for this CMS. A separate frontend can `curl` it straight into its src:
//   curl https://cms.example.com/api/content-types.ts -o src/cms-content.ts
// Pure function of the site's content model → built once per model and cached.
const cached = cmsProcessWide(new WeakMap<object, string>(), 'generated from a content model alone, so the same for every site of that model; kept by model')

export default defineEventHandler((event) => {
  assertContentAuth(event)
  const { config } = cmsSiteModel()
  let text = cached.get(config)
  if (text === undefined) cached.set(config, text = emitContentTypes(config))
  setContentCache(event)
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return text
})
