// RFC 9728: which server issues tokens for /api/mcp (cmsOAuth.ts). Served at the bare and the
// path-aware address, since clients ask for either.
export default defineEventHandler((event) => {
  assertCmsOAuth()
  return cmsOAuthResourceMetadata(event)
})
