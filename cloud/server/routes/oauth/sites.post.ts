import { isAccountId } from '#shared/account'

// POST /oauth/sites: a website's server asks which other websites a person has, for its
// switcher (docs/multi-tenant-plan.md, 2.15). `Authorization: Basic base64(client_id:client_secret)`,
// JSON `{ sub }`. The answer names only clients OF THE SAME OWNER as the asking client that the
// person is a member of (or owns): a website never learns about websites of other owners.
// `account` is the person's "My websites" page.
export default defineEventHandler(async (event) => {
  await migrationsReady()
  setResponseHeader(event, 'cache-control', 'no-store')
  if (oauthLimits.ipLimited(event)) return oauthRefusal(event, 429, 'too_many_requests')
  const client = await clientOfRequest(event)
  if (!client) return oauthRefusal(event, 401, 'invalid_client', { basic: true })

  const body = await readBody<Record<string, unknown> | null>(event).catch(() => null)
  const sub = body && typeof body === 'object' ? body.sub : null
  if (!isAccountId(sub)) return oauthRefusal(event, 400, 'invalid_request')

  const sites = await switcherSites(client, sub)
  return { sites, account: `${issuerUrl(event)}/sites` }
})
