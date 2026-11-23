import { eq } from 'drizzle-orm'

// POST /oauth/token: a website's server exchanges the one-time code for who the person is
// (docs/multi-tenant-plan.md, 2.15). JSON in, JSON out; the website proves itself with its
// client secret and the code with its PKCE verifier. There is no token to keep: the answer is
// the person, and the website opens its own session.
//
//   401 { error: "invalid_client" }   an unknown or revoked client, a wrong secret
//   400 { error: "invalid_grant" }    a code that is unknown, used, older than a minute, another
//                                     client's, or sent with a wrong address or verifier
//   400 { error: "invalid_request" | "unsupported_grant_type" }   not this request at all
//   429 { error: "too_many_requests" }
//
// A code is spent by the first try of its own client. On success the person becomes a member
// of the client.

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

export default defineEventHandler(async (event) => {
  await migrationsReady()
  setResponseHeader(event, 'cache-control', 'no-store')
  if (oauthLimits.ipLimited(event)) return oauthRefusal(event, 429, 'too_many_requests')

  const body = await readBody<Record<string, unknown> | null>(event).catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return oauthRefusal(event, 400, 'invalid_request')
  if (text(body.grant_type) !== 'authorization_code') return oauthRefusal(event, 400, 'unsupported_grant_type')

  const client = await authenticateClient(body.client_id, body.client_secret)
  if (!client) {
    oauthLimits.noteIp(event)
    return oauthRefusal(event, 401, 'invalid_client')
  }
  if (oauthLimits.clientLimited(client.id)) return oauthRefusal(event, 429, 'too_many_requests')

  const userId = await redeemCode(client, { code: body.code, redirectUri: body.redirect_uri, codeVerifier: body.code_verifier })
  const [user] = userId
    ? await useDb().select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, locale: schema.users.locale, emailVerifiedAt: schema.users.emailVerifiedAt })
        .from(schema.users).where(eq(schema.users.id, userId))
    : []
  if (!user) {
    oauthLimits.noteIp(event)
    oauthLimits.noteClient(client.id)
    return oauthRefusal(event, 400, 'invalid_grant')
  }

  await noteSignIn(client.id, user.id)
  // `email_verified` is the account's own truth: a website links a person by e-mail only when it is true.
  return { user: { sub: user.id, email: user.email, email_verified: !!user.emailVerifiedAt, name: user.name, locale: user.locale } }
})
