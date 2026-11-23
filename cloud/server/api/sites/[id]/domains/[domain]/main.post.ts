import { z } from 'zod'

// Make a domain the website's address (`main: true`), or go back to the address at the service
// (`main: false`). The website's address at the account service follows in the same step.
const input = z.object({ main: z.boolean() })

export default defineEventHandler(async (event) => {
  const { me, site } = await requireOwnSite(event)
  const { main } = await readInput(event, input)
  if (tooManyAttempts(`domain:${me.id}`, 30, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  return { domain: await setMainDomain(site, getRouterParam(event, 'domain') ?? '', main) }
})
