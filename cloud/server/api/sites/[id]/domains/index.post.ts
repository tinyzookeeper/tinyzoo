import { z } from 'zod'

// Add a domain of my own to a website. Its DNS is looked at right away: a name that already
// leads to the service is in use at once, any other waits (and nothing about the website changes).
const input = z.object({ host: z.string().max(300) })

export default defineEventHandler(async (event) => {
  const { me, site } = await requireOwnSite(event)
  const { host } = await readInput(event, input)
  if (tooManyAttempts(`domain:${me.id}`, 30, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  const domain = await addDomain(site, host)
  setResponseStatus(event, 201)
  return { domain }
})
