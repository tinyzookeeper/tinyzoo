// POST /api/mcp/oauth/token — a code for tokens, or a refresh token for the next access token.
// Errors in OAuth's shape (RFC 6749 §5.2): `invalid_grant` tells a client to send its person
// through sign-in again. Form or JSON bodies; no client secret (public clients, PKCE).
export default defineEventHandler(async (event) => {
  assertCmsOAuth()
  setResponseHeader(event, 'cache-control', 'no-store')
  const fail = (error: string, description: string, status = 400) => {
    setResponseStatus(event, status)
    return { error, error_description: description }
  }
  if (!(await rateLimit(`oauth-token:${clientIp(event)}`, 120, 10 * 60_000))) return fail('slow_down', 'Too many requests; try again later', 429)
  const body = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>
  const str = (key: string): string | null => (typeof body[key] === 'string' && (body[key] as string).length ? body[key] as string : null)
  try {
    const grant = str('grant_type')
    if (grant === 'authorization_code') {
      const code = str('code')
      const clientId = str('client_id')
      const verifier = str('code_verifier')
      if (!code || !clientId || !verifier) return fail('invalid_request', 'code, client_id and code_verifier are required')
      return await exchangeOAuthCode({ code, clientId, redirectUri: str('redirect_uri'), codeVerifier: verifier, resource: str('resource'), canonicalResource: cmsMcpResourceUrl(event) })
    }
    if (grant === 'refresh_token') {
      const refreshToken = str('refresh_token')
      if (!refreshToken) return fail('invalid_request', 'refresh_token is required')
      return await refreshOAuthAccess({ refreshToken, clientId: str('client_id') })
    }
    return fail('unsupported_grant_type', 'Supported grants are authorization_code and refresh_token')
  }
  catch (err) {
    if (isCmsOAuthFailure(err)) return fail(err.oauth.code, err.oauth.description, err.oauth.status)
    console.error('[cms] oauth token endpoint failed', scrubError(err))
    return fail('server_error', 'Something went wrong issuing the token', 500)
  }
})
