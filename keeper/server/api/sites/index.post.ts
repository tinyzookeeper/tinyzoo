export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const data = await readInput(event, siteInput)
  const [row] = await useDb().insert(schema.sites).values({
    workspaceId: me.workspaceId,
    name: data.name,
    client: data.client ?? '',
    url: data.url,
    environment: data.environment ?? 'production',
    tokenEnc: data.token ? encryptSecret(data.token) : null,
    repoUrl: data.repoUrl ?? '',
    notes: data.notes ?? '',
  }).returning({ id: schema.sites.id })
  checkSoon(event, row!.id)
  setResponseStatus(event, 201)
  return { id: row!.id }
})
