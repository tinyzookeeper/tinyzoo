// RFC 7009: revoke a connection by its access or refresh token. Always 200, so it cannot be
// used to find out whether a token exists.
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>
  if (typeof body.token === 'string' && body.token) await revokeSecret(body.token)
  return {}
})
