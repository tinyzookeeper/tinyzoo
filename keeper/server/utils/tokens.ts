import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { AccessToken } from '#keeper/types/keeper'

/**
 * Access tokens: `kpr_` and 43 random characters, sent as `Authorization: Bearer kpr_…`.
 * Only the SHA-256 is stored. A token acts as the person who made it, in every workspace they
 * are in (and only while they are in it). Tokens never appear in logs or error messages.
 */

export type TokenScope = 'read' | 'write'

const PREFIX = 'kpr_'
const TOKEN_RE = /^kpr_[\w-]{43}$/

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** A new token: the value (shown once), what is stored of it, and the part shown later. */
export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = PREFIX + randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token), prefix: token.slice(0, PREFIX.length + 6) }
}

/** The bearer token of the request: null without one, '' when the header is malformed. */
function bearer(event: H3Event): string | null {
  const header = getRequestHeader(event, 'authorization')?.trim()
  // Another scheme (a proxy's Basic auth) is not ours: leave it to the session.
  if (!header || !/^Bearer\b/i.test(header)) return null
  return /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? ''
}

const unauthorized = (event: H3Event, message: string) => {
  // Points a client at the OAuth sign-in (RFC 9728), the way in for one given only the address.
  setResponseHeader(event, 'WWW-Authenticate', mcpWwwAuthenticate(event))
  return createError({ statusCode: 401, statusMessage: message })
}

/** Who the token belongs to, or 401. Failed tries are counted per address (429 after 20 in 10 minutes). */
async function accessForToken(event: H3Event, token: string): Promise<Access> {
  const limitKey = `token:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`
  if (isLimited(limitKey, 20)) throw createError({ statusCode: 429, statusMessage: 'Too many wrong tokens, try again in a few minutes' })
  const fail = () => {
    noteFailure(limitKey)
    return unauthorized(event, 'Unknown or revoked access token')
  }
  if (!TOKEN_RE.test(token)) throw fail()

  const db = useDb()
  const [row] = await db.select({
    id: schema.tokens.id, userId: schema.tokens.createdBy, scope: schema.tokens.scope,
    lastUsedAt: schema.tokens.lastUsedAt, accessExpiresAt: schema.tokens.accessExpiresAt,
  })
    .from(schema.tokens)
    .where(and(eq(schema.tokens.hash, hashToken(token)), isNull(schema.tokens.revokedAt)))
  // A connection signed in over OAuth: its access token lasts an hour (the client refreshes it).
  if (!row || !row.userId || (row.accessExpiresAt && row.accessExpiresAt.getTime() <= Date.now())) throw fail()
  const memberships = await loadMemberships(row.userId)
  // Someone in no workspace any more has nothing a token could reach.
  if (!memberships.length) throw fail()

  // Note the use at most once a minute.
  const now = new Date()
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(schema.tokens).set({ lastUsedAt: now })
      .where(and(eq(schema.tokens.id, row.id), or(isNull(schema.tokens.lastUsedAt), lt(schema.tokens.lastUsedAt, new Date(now.getTime() - 60_000)))))
  }
  return { userId: row.userId, scope: row.scope, via: 'token', tokenId: row.id, memberships }
}

/**
 * Who is behind the request: an access token (`Authorization: Bearer kpr_…`) or the session
 * cookie. `tokenOnly` refuses the session (the MCP server). Whether they may write is asked per
 * workspace (canWriteIn): a guest only looks there, a read token only looks anywhere.
 */
export async function requireAccess(event: H3Event, opts: { tokenOnly?: boolean } = {}): Promise<Access> {
  const token = bearer(event)
  if (token !== null) {
    if (!token) throw unauthorized(event, 'Send the token as: Authorization: Bearer kpr_…')
    return accessForToken(event, token)
  }
  if (opts.tokenOnly) throw unauthorized(event, 'Send an access token as: Authorization: Bearer kpr_… (Keeper → Settings → Access tokens)')
  return requireMember(event)
}

/** 403 for a write this request may not make in a workspace: a guest, or a read-only token. */
export function assertWrite(access: Access, m: Membership): void {
  if (canWriteIn(access, m)) return
  throw createError({
    statusCode: 403,
    statusMessage: m.role === 'guest'
      ? `You are a guest in ${m.name}: you can look, not change. Ask an owner or admin for more.`
      : 'This access token is read-only. Make a write token in Settings → Access tokens.',
  })
}

/** A token row as the list shows it (the list is always the person's own). */
export function toAccessToken(r: { id: string; name: string; scope: TokenScope; prefix: string; createdAt: Date; lastUsedAt: Date | null; origin?: 'manual' | 'oauth'; clientName?: string | null }): AccessToken {
  return {
    id: r.id,
    name: r.name,
    scope: r.scope,
    prefix: r.prefix,
    origin: r.origin ?? 'manual',
    client: r.origin === 'oauth' ? (r.clientName ?? 'An MCP client') : null,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  }
}
