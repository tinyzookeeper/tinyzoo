import { and, desc, eq, isNull } from 'drizzle-orm'
import type { AccessToken } from '#keeper/types/keeper'

// My working tokens and connections (session only: a token cannot list tokens). A token is
// personal: it acts as me in every workspace I am in.
export default defineEventHandler(async (event): Promise<AccessToken[]> => {
  const me = await requireMember(event)
  const rows = await useDb().select({
    id: schema.tokens.id, name: schema.tokens.name, scope: schema.tokens.scope, prefix: schema.tokens.prefix,
    createdAt: schema.tokens.createdAt, lastUsedAt: schema.tokens.lastUsedAt,
    origin: schema.tokens.origin, clientName: schema.oauthClients.name, refreshExpiresAt: schema.tokens.refreshExpiresAt,
  })
    .from(schema.tokens)
    .leftJoin(schema.oauthClients, eq(schema.oauthClients.id, schema.tokens.clientId))
    .where(and(eq(schema.tokens.createdBy, me.userId), isNull(schema.tokens.revokedAt)))
    .orderBy(desc(schema.tokens.createdAt))
  // A connection whose refresh token has run out is over.
  const now = Date.now()
  return rows.filter((r) => !r.refreshExpiresAt || r.refreshExpiresAt.getTime() > now).map(toAccessToken)
})
