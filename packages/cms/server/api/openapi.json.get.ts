import { buildOpenApiDocument } from 'tinyzoo'
// virtual alias provided by the module (build-time); typed through the host's tsconfig paths
import * as cmsConfig from '#cms/config'

// GET /api/openapi.json — OpenAPI 3.1 document for the public content API,
// generated from cms.config.ts. Gated by the same optional content token.
//
// The document is a pure function of the (immutable) config, so it is built once
// and cached. NB: the `servers` URL comes from configured `cms.content.publicUrl`,
// NOT the request Host — reflecting an attacker-controlled Host into the publicly
// cacheable spec would be a cache-poisoning vector.
let cached: Record<string, any> | undefined

export default defineEventHandler((event) => {
  assertContentAuth(event)
  if (!cached) {
    const content = (useRuntimeConfig().cms as any)?.content ?? {}
    cached = buildOpenApiDocument(cmsConfig as Record<string, any>, {
      title: 'Content API',
      servers: content.publicUrl ? [{ url: content.publicUrl }] : undefined,
      tokenAuth: !!content.token,
    })
  }
  setContentCache(event)
  return cached
})
