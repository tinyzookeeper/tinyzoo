import { z } from 'zod'

// A website that moved away: delete its database and its files here. Asks for the address
// typed out. Its address keeps sending visitors to the new one until the website is deleted.
const input = z.object({ confirm: z.string().max(80) })

export default defineEventHandler(async (event) => {
  const { site } = await requireOwnSite(event)
  const { confirm } = await readInput(event, input)
  if (confirm.trim().toLowerCase() !== site.slug) throw fail(422, 'remove.confirm', 'Type the address of the website to confirm')
  return { site: toSiteView(await removeMovedData(site)) }
})
