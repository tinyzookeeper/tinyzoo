import { isAccountId } from '#shared/account'

// POST /oauth/membership: a website's server says which role a person has there, or that it no
// longer lets them in (docs/multi-tenant-plan.md, 2.15). Basic auth as /oauth/sites, JSON
// `{ sub, role, active }`. The issuer only keeps it for showing: rights stay on the website.
//
// A website can only speak about people who signed in to it through the account (a code it
// exchanged made them its members): about anybody else it gets 404 { error: "not_found" }, so a
// website cannot put itself into the list of a person who never came to it.
export default defineEventHandler(async (event) => {
  await migrationsReady()
  setResponseHeader(event, 'cache-control', 'no-store')
  if (oauthLimits.ipLimited(event)) return oauthRefusal(event, 429, 'too_many_requests')
  const client = await clientOfRequest(event)
  if (!client) return oauthRefusal(event, 401, 'invalid_client', { basic: true })

  const body = await readBody<Record<string, unknown> | null>(event).catch(() => null)
  if (!body || typeof body !== 'object' || !isAccountId(body.sub)) return oauthRefusal(event, 400, 'invalid_request')
  if (body.active !== undefined && typeof body.active !== 'boolean') return oauthRefusal(event, 400, 'invalid_request')

  // `active` left out means the person is let in (the website is telling their role).
  const known = await reportMembership(client.id, body.sub, { role: body.role, active: body.active !== false })
  if (!known) return oauthRefusal(event, 404, 'not_found')
  return { ok: true }
})
