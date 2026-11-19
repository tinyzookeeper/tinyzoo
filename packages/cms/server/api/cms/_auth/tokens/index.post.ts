import { and, eq, gt, isNull, or, sql } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_auth/tokens — make a personal access token for the MCP server. Its value is
// answered once and never again (only its SHA-256 is kept). Its rights are held to your role.
const input = z.object({
  name: z.string().trim().min(1).max(80),
  rights: tokenRightsSchema,
  // How long it works, in days; null: until it is revoked.
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).nullable(),
})

export default defineEventHandler(async (event) => {
  const user = requireTokenOwner(event)
  const data = parseOr422(input, await readBody(event))
  const rights = clampTokenRights(data.rights, user)
  const { db, reg } = useCms()
  const t = reg.cmsAccessTokens
  const [counted] = await db.select({ n: sql<number>`count(*)::int` }).from(t)
    .where(and(eq(t.userId, user.id), isNull(t.revokedAt), or(isNull(t.expiresAt), gt(t.expiresAt, new Date()))))
  if ((counted?.n ?? 0) >= MAX_TOKENS_PER_PERSON) throw createError({ statusCode: 409, statusMessage: `You have ${MAX_TOKENS_PER_PERSON} tokens; revoke one first` })
  const { token, hash, prefix } = generateAccessToken()
  const expiresAt = data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null
  const [row] = await db.insert(t).values({ userId: user.id, name: data.name, tokenHash: hash, prefix, rights, expiresAt }).returning()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'The token was not saved' })
  await audit(event, 'token.create', { recordId: row.id, meta: { name: data.name, rights, expiresAt: expiresAt?.toISOString() ?? null } })
  setResponseStatus(event, 201)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { token: accessTokenView(row), value: token }
})
