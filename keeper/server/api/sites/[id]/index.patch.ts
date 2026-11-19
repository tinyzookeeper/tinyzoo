import { eq } from 'drizzle-orm'

// Change a site. `token` left out keeps the stored one; '' removes it.
export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const site = await siteOf(event, me.workspaceId)
  const data = await readInput(event, siteInput.partial())
  const urlChanged = data.url !== undefined && data.url !== site.url
  const tokenChanged = data.token !== undefined
  await useDb().update(schema.sites).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.client !== undefined ? { client: data.client } : {}),
    ...(data.url !== undefined ? { url: data.url } : {}),
    ...(data.environment !== undefined ? { environment: data.environment } : {}),
    ...(data.repoUrl !== undefined ? { repoUrl: data.repoUrl } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(tokenChanged ? { tokenEnc: data.token ? encryptSecret(data.token) : null, statusError: null } : {}),
    // Another address is another site as far as the checks go.
    ...(urlChanged ? { state: 'unknown' as const, stateSince: null, failStreak: 0, status: null, statusAt: null, statusError: null, certExpiresAt: null, certError: null } : {}),
    ...(tokenChanged && !data.token ? { status: null, statusAt: null } : {}),
    updatedAt: new Date(),
  }).where(eq(schema.sites.id, site.id))
  if (urlChanged || tokenChanged) checkSoon(event, site.id)
  return { ok: true }
})
