import { z } from 'zod'

// POST /api/mcp/oauth/register — RFC 7591: a program registers itself, so the address of
// /api/mcp is the whole setup. A registration grants nothing: its person still decides on the
// admin's connect page. Public clients only (no secret): PKCE binds a code to who asked for it.
const input = z.object({
  redirect_uris: z.array(z.string().min(1).max(2000)).min(1).max(10),
  client_name: z.string().max(200).optional(),
  client_uri: z.string().max(2000).optional(),
})

export default defineEventHandler(async (event) => {
  assertCmsOAuth()
  if (!(await rateLimit(`oauth-register:${clientIp(event)}`, 20, 10 * 60_000))) throw tooManyRequests(event, 'Too many registrations; try again later', 10 * 60_000)
  const parsed = input.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { error: 'invalid_client_metadata', error_description: 'redirect_uris is required: a list of addresses' }
  }
  try {
    const client = await registerOAuthClient({ name: parsed.data.client_name ?? '', redirectUris: parsed.data.redirect_uris, clientUri: parsed.data.client_uri })
    setResponseStatus(event, 201)
    return {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'mcp:read mcp:write',
    }
  }
  catch (err) {
    if (!isCmsOAuthFailure(err)) throw err
    setResponseStatus(event, err.oauth.status)
    return { error: err.oauth.code, error_description: err.oauth.description }
  }
})
