// POST /api/mcp/oauth/revoke — RFC 7009: end a connection by its access or refresh token.
// Always 200, so it cannot tell anyone whether a token exists.
export default defineEventHandler(async (event) => {
  assertCmsOAuth()
  const body = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>
  if (typeof body.token === 'string' && body.token) await revokeOAuthSecret(body.token)
  return {}
})
