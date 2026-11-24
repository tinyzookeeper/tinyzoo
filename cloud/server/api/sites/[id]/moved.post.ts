import { z } from 'zod'

// "It now lives elsewhere": every request to the website's address here is sent on to the new one.
const input = z.object({ url: z.string().max(300) })

export default defineEventHandler(async (event) => {
  const { me, site } = await requireOwnSite(event)
  const { url } = await readInput(event, input)
  if (tooManyAttempts(`moved:${me.id}`, 12, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  return { site: toSiteView(await markMoved(site, url)) }
})
