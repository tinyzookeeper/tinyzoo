import { z } from 'zod'

// Delete a website: it stops and its data is removed. Asks for the address typed out.
const input = z.object({ confirm: z.string().max(80) })

export default defineEventHandler(async (event) => {
  const { site } = await requireOwnSite(event)
  const { confirm } = await readInput(event, input)
  if (confirm.trim().toLowerCase() !== site.slug) throw fail(422, 'remove.confirm', 'Type the address of the website to confirm')
  if (site.status === 'creating') throw fail(409, 'remove.busy', 'The website is still being made')
  if (site.status !== 'removing') await removeSite(site)
  return { ok: true }
})
