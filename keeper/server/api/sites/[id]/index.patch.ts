// Change a site. `token` left out keeps the stored one; '' removes it.
export default defineEventHandler(async (event) => {
  const me = await requireAccess(event, 'write')
  const site = await siteOf(event, me)
  await updateSite(event, me, site, await readInput(event, siteInput.partial()))
  return { ok: true }
})
