import { buildOpenApiDocument } from 'tinyzoo'
// virtual alias provided by the module (build-time); typed through the host's tsconfig paths
import * as cmsConfig from '#cms/config'

// GET /api/openapi.json — OpenAPI 3.1 document for the public content API,
// generated from cms.config.ts. Gated by the same optional content token.
//
// Unlike the interactive page (/api/openapi, off in production by default), this
// document stays available: the docs tell people to feed it to code generators
// (`openapi-typescript https://…/api/openapi.json`). It describes only what the public
// content API already returns — public collections, their non-hidden fields — and a site
// that wants it closed sets a content token.
//
// The document is a pure function of the (immutable) config, so it is built once
// and cached. NB: the `servers` URL comes from configured `cms.content.publicUrl`
// (or, when that is empty, `cms.publicUrl`), NOT the request Host — reflecting an attacker-controlled Host into the publicly
// cacheable spec would be a cache-poisoning vector.
let cached: Record<string, any> | undefined

export default defineEventHandler((event) => {
  assertContentAuth(event)
  if (!cached) {
    const cms = (useRuntimeConfig().cms as any) ?? {}
    const content = cms.content ?? {}
    // `cms.content.publicUrl` wins; a site that set only `cms.publicUrl` (emails, sitemap) gets it here too.
    const serverUrl = String(content.publicUrl || '').trim() || String(cms.publicUrl || '').trim()
    cached = buildOpenApiDocument(cmsConfig as Record<string, any>, {
      title: 'Content API',
      servers: serverUrl ? [{ url: serverUrl }] : undefined,
      tokenAuth: !!content.token,
    })
  }
  setContentCache(event)
  return cached
})
