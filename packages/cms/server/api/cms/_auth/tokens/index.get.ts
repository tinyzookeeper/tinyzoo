import { and, desc, eq, isNull } from 'tinyzoo'

// GET /api/cms/_auth/tokens — your own working access tokens (never the tokens themselves),
// and what your role lets a token do, for the form that makes one: publishing, files, and the
// collections and globals you can open.
export default defineEventHandler(async (event) => {
  const user = requireTokenOwner(event)
  const { db, reg } = useCms()
  const t = reg.cmsAccessTokens
  const rows = await db.select().from(t).where(and(eq(t.userId, user.id), isNull(t.revokedAt))).orderBy(desc(t.createdAt))
  const role = roleOf(user)!
  const now = Date.now()
  return {
    tokens: rows.filter((r: any) => !r.expiresAt || r.expiresAt.getTime() > now).map(accessTokenView),
    can: { publish: role.publish, media: role.media !== 'none' },
    areas: reg.graph
      .map((g) => reg.byName.get(g.name))
      .filter((e): e is NonNullable<typeof e> => !!e && accessWhere(e, 'read', user).allowed)
      .map((e) => ({ name: e.name, label: e.label, kind: e.singleton ? 'global' : 'collection' })),
    max: MAX_TOKENS_PER_PERSON,
  }
})
