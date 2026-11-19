import { and, desc, eq, isNull } from 'drizzle-orm'
import type { AccessToken } from '#keeper/types/keeper'

// The workspace's working tokens (session only: a token cannot list tokens). People limited
// to some clients, and viewers, see only their own.
export default defineEventHandler(async (event): Promise<AccessToken[]> => {
  const me = await requireMember(event)
  const rows = await useDb().select({
    id: schema.tokens.id, name: schema.tokens.name, scope: schema.tokens.scope, prefix: schema.tokens.prefix,
    createdAt: schema.tokens.createdAt, lastUsedAt: schema.tokens.lastUsedAt, userId: schema.tokens.createdBy,
    userName: schema.users.name, userEmail: schema.users.email,
    origin: schema.tokens.origin, clientName: schema.oauthClients.name, refreshExpiresAt: schema.tokens.refreshExpiresAt,
  })
    .from(schema.tokens)
    .leftJoin(schema.users, eq(schema.users.id, schema.tokens.createdBy))
    .leftJoin(schema.oauthClients, eq(schema.oauthClients.id, schema.tokens.clientId))
    .where(and(
      eq(schema.tokens.workspaceId, me.workspaceId),
      isNull(schema.tokens.revokedAt),
      seesAllClients(me) && me.role !== 'viewer' ? undefined : eq(schema.tokens.createdBy, me.userId),
    ))
    .orderBy(desc(schema.tokens.createdAt))
  // A connection whose refresh token has run out is over.
  const now = Date.now()
  return rows.filter((r) => !r.refreshExpiresAt || r.refreshExpiresAt.getTime() > now).map((r) => toAccessToken(r, me))
})
