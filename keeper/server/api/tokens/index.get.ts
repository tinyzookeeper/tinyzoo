import { and, desc, eq, isNull } from 'drizzle-orm'
import type { AccessToken } from '#keeper/types/keeper'

// The workspace's working tokens (session only: a token cannot list tokens).
export default defineEventHandler(async (event): Promise<AccessToken[]> => {
  const me = await requireMember(event)
  const rows = await useDb().select({
    id: schema.tokens.id, name: schema.tokens.name, scope: schema.tokens.scope, prefix: schema.tokens.prefix,
    createdAt: schema.tokens.createdAt, lastUsedAt: schema.tokens.lastUsedAt, userId: schema.tokens.createdBy,
    userName: schema.users.name, userEmail: schema.users.email,
  })
    .from(schema.tokens)
    .leftJoin(schema.users, eq(schema.users.id, schema.tokens.createdBy))
    .where(and(eq(schema.tokens.workspaceId, me.workspaceId), isNull(schema.tokens.revokedAt)))
    .orderBy(desc(schema.tokens.createdAt))
  return rows.map((r) => toAccessToken(r, me))
})
