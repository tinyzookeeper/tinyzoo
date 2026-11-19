// GET /api/cms/_auth/oauth/:id — what the connect page shows: who asks (a claim), where the
// answer goes (a fact), whether it asked to write, and what the person's role lets a
// connection do. For the person signed in; never cross-origin.
export default defineEventHandler(async (event) => {
  const user = requireTokenOwner(event)
  const row = await loadOAuthRequest(getRouterParam(event, 'id') ?? '')
  if (!row) throw createError({ statusCode: 410, statusMessage: 'This request is no longer open' })
  const { reg } = useCms()
  const role = roleOf(user)!
  return {
    client: row.clientName,
    redirectHost: oauthRedirectHost(row.redirectUri),
    write: row.scope === 'write',
    can: { publish: role.publish, media: role.media !== 'none' },
    areas: reg.graph
      .map((g) => reg.byName.get(g.name))
      .filter((e): e is NonNullable<typeof e> => !!e && accessWhere(e, 'read', user).allowed)
      .map((e) => ({ name: e.name, label: e.label, kind: e.singleton ? 'global' : 'collection' })),
  }
})
