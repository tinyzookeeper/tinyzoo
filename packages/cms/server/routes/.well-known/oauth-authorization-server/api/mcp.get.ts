// RFC 8414: where a program registers, signs in and gets tokens for /api/mcp (cmsOAuth.ts).
// Served at the bare and the path-aware address, since clients ask for either.
export default defineEventHandler((event) => {
  assertCmsOAuth()
  return cmsOAuthServerMetadata(event)
})
