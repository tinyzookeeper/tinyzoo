import { eq } from 'drizzle-orm'
import { redirectAllowed, returnPath } from '#shared/account'

// What the sign-in page is about to come back to: when it is a website's sign-in through the
// account (`next` is an /oauth/authorize address of this app), the website's name and host, so
// the page can say where the person is going. Anything else: null. Nothing here is secret: the
// name and the address are the website's public ones.
export default defineEventHandler(async (event): Promise<{ site: { name: string; host: string } | null }> => {
  const next = returnPath(getQuery(event).next)
  if (!next || !next.startsWith('/oauth/authorize?')) return { site: null }
  const query = new URL(next, 'http://app.invalid').searchParams
  const client = await findClient(query.get('client_id'))
  if (!client || client.revokedAt || !redirectAllowed(client.url, query.get('redirect_uri'))) return { site: null }
  const [site] = client.siteId ? await useDb().select({ name: schema.sites.name }).from(schema.sites).where(eq(schema.sites.id, client.siteId)) : []
  return { site: { name: site?.name ?? client.name, host: new URL(client.url!).host } }
})
