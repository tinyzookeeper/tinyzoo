import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, isNull } from 'tinyzoo'
import type { CmsEntity, CmsResolvedRole } from 'tinyzoo'
import { z } from 'zod'

/**
 * Personal access tokens (`tzp_…`, cms_access_tokens) for the MCP server at `/api/mcp`.
 *
 * A token acts as the person who made it. Its `rights` narrow what their role allows, never
 * widen it: the token's user carries them (`cmsUser.token`), `roleOf` hands every check a
 * narrowed copy of the role (publishing, people management) and `roleAccess` asks
 * `tokenAllows` about each collection and operation. So the rules of the admin apply as they
 * are, field access included.
 *
 * A token is only taken at `/api/mcp`. The MCP tools then call the admin's own routes inside
 * this process with `x-tinyzoo-mcp` (a secret of this process plus the token's id), which the
 * session middleware turns into the token's user for a few content routes, never for
 * accounts, people or privacy (`MCP_ROUTES`).
 *
 * The second place a token is taken: the routes of a site's own content types under
 * `/api/cms/_model` that a developer's tools call (`requireModelCaller` in cmsModelCode.ts), for a
 * token with the right `model` only.
 */

export interface CmsTokenRights {
  /** Create and change entries and globals (drafts, without `publish`). Without it the token only reads. */
  write: boolean
  /** Publish and unpublish (and write what is live the moment it is saved). Needs `write` and a role that may publish. */
  publish: boolean
  /** Delete entries (and, with `media`, files). Needs `write`. */
  delete: boolean
  /** Upload and change files in the media library. Needs `write` and a role with the library. */
  media: boolean
  /** Only these collections and globals (by name); null: every one the role reaches. */
  entities: string[] | null
  /**
   * Content types (experimental): read the site's own content types, change them and register
   * code against them, at the routes under `/api/cms/_model` (cmsModelCode.ts). Only an
   * administrator can give it, on a site with the feature on, and it works only while that
   * person is an administrator. Never a deletion for good. Absent: false.
   */
  model?: boolean
}

/** What `cmsUser.token` holds for a request made with an access token. */
export interface CmsTokenGrant {
  id: string
  rights: CmsTokenRights
}

export const ACCESS_TOKEN_PREFIX = 'tzp_'
const TOKEN_RE = /^tzp_[\w-]{43}$/

export const hashAccessToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** A new token: the value (shown once), its hash (stored) and the start shown in lists. */
export function generateAccessToken(): { token: string; hash: string; prefix: string } {
  const token = ACCESS_TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return { token, hash: hashAccessToken(token), prefix: token.slice(0, ACCESS_TOKEN_PREFIX.length + 6) }
}

export const tokenRightsSchema = z.object({
  write: z.boolean(),
  publish: z.boolean(),
  delete: z.boolean(),
  media: z.boolean(),
  entities: z.array(z.string().min(1).max(100)).max(200).nullable(),
  model: z.boolean().optional(),
})

/**
 * The rights asked for, held to what the person's role can give: a right the role does not have
 * is dropped, the others need `write`, and only collections the role may read are kept (unknown
 * names are refused). Null when the role gives nothing at all (a role the site does not know).
 */
export function clampTokenRights(asked: CmsTokenRights, user: CmsUser): CmsTokenRights {
  const role = roleOf(user)
  if (!role) throw createError({ statusCode: 403, statusMessage: 'Your role no longer exists; ask an administrator to give you another' })
  const { reg } = useCms()
  let entities: string[] | null = null
  if (asked.entities) {
    const unknown = asked.entities.filter((n) => !reg.byName.has(n))
    if (unknown.length) throw createError({ statusCode: 422, statusMessage: `Unknown collection: ${unknown.join(', ')}` })
    entities = [...new Set(asked.entities)].filter((n) => accessWhere(reg.byName.get(n)!, 'read', user).allowed)
    if (!entities.length) throw createError({ statusCode: 422, statusMessage: 'Pick at least one collection you can open' })
  }
  const write = asked.write
  // Content types: the person manages the site, and the site has the feature. Left out when not given, as a token made before it.
  const model = asked.model === true && role.manage && cmsCustomTypes().on
  return {
    write,
    publish: write && asked.publish && role.publish,
    delete: write && asked.delete,
    media: write && asked.media && role.media !== 'none',
    entities,
    ...(model ? { model: true } : {}),
  }
}

/** The role as a token sees it: no more publishing than the token's rights allow, and never people management. */
export function narrowRole(role: CmsResolvedRole, rights: CmsTokenRights): CmsResolvedRole {
  return { ...role, publish: role.publish && rights.write && rights.publish, manage: false }
}

/** May a request made with this token do `op` on this collection or global (before the role is asked)? True without a token. */
export function tokenAllows(user: { token?: CmsTokenGrant } | null | undefined, e: CmsEntity, op: 'read' | 'create' | 'update' | 'delete'): boolean {
  const grant = user?.token
  if (!grant) return true
  const r = grant.rights
  if (r.entities && !r.entities.includes(e.name)) return false
  if (op === 'read') return true
  if (!r.write) return false
  return op !== 'delete' || r.delete
}

/** Refuse a change to the media library (upload, change, `delete`) that the request's token was not given. */
export function assertTokenMedia(user: { token?: CmsTokenGrant } | null | undefined, op: 'write' | 'delete' = 'write'): void {
  const r = user?.token?.rights
  if (!r) return
  if (!r.media) throw createError({ statusCode: 403, statusMessage: 'This access token cannot change files' })
  if (op === 'delete' && !r.delete) throw createError({ statusCode: 403, statusMessage: 'This access token cannot delete' })
}

/** A row of cms_access_tokens as an account's list shows it (never the token or its hash). */
export function accessTokenView(row: any, clientName?: string | null) {
  return {
    id: row.id as string,
    name: row.name as string,
    prefix: row.prefix as string,
    // manual: made on the account page; oauth: a program that signed in (its token changes every hour).
    origin: (row.origin ?? 'manual') as 'manual' | 'oauth',
    client: row.origin === 'oauth' ? (clientName ?? 'An MCP client') : null,
    rights: row.rights as CmsTokenRights,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    expiresAt: row.expiresAt?.toISOString?.() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString?.() ?? null,
  }
}

// ── using a token ──────────────────────────────────────────────────────────────

/** The account a token's row may act as: active, with a role the site knows. */
function userOfToken(token: any, account: any): CmsUser | null {
  if (!account || account.status !== 'active') return null
  const user: CmsUser = { id: account.id, email: account.email, name: account.name || account.email, role: account.role, locale: account.locale, token: { id: token.id, rights: token.rights } }
  return roleOf(user) ? user : null
}

// Revoked, past its end, or (signed in over OAuth) an access token older than its hour: no.
const usable = (t: any) => !t.revokedAt && (!t.expiresAt || t.expiresAt.getTime() > Date.now()) && (!t.accessExpiresAt || t.accessExpiresAt.getTime() > Date.now())

/** Note the token's use, at most once a minute. */
async function touch(t: any): Promise<void> {
  const now = new Date()
  if (t.lastUsedAt && now.getTime() - t.lastUsedAt.getTime() < 60_000) return
  const { db, reg } = useCms()
  await db.update(reg.cmsAccessTokens).set({ lastUsedAt: now }).where(eq(reg.cmsAccessTokens.id, t.id)).catch(() => {})
}

/**
 * The user behind `Authorization: Bearer tzp_…`, or 401. Wrong tokens are counted per address
 * (20 in 10 minutes, then 429). Built-in sign-in only: with an external one there are no accounts
 * here to act as.
 */
export async function requireTokenUser(event: any): Promise<CmsUser> {
  const unauthorized = (message: string) => {
    // Points a client at the OAuth sign-in (RFC 9728): the way in for one given only the address.
    setResponseHeader(event, 'WWW-Authenticate', cmsMcpWwwAuthenticate(event))
    return createError({ statusCode: 401, statusMessage: message })
  }
  const header = String(getHeader(event, 'authorization') ?? '').trim()
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1]
  if (!token) throw unauthorized('Sign in (OAuth), or send a personal access token: Authorization: Bearer tzp_… (admin → your account → Access tokens)')
  const key = `mcp-token:${clientIp(event)}`
  const windowMs = 10 * 60_000
  if (!(await rateLimit(key, 20, windowMs))) throw tooManyRequests(event, 'Too many wrong tokens; try again later', windowMs)
  const { db, reg } = useCms()
  const t = reg.cmsAccessTokens
  const [row] = TOKEN_RE.test(token)
    ? await db.select({ token: t, account: reg.cmsUsers }).from(t).innerJoin(reg.cmsUsers, eq(reg.cmsUsers.id, t.userId))
      .where(and(eq(t.tokenHash, hashAccessToken(token)), isNull(t.revokedAt)))
    : []
  const user = row && usable(row.token) ? userOfToken(row.token, row.account) : null
  if (!row || !user) throw unauthorized('Unknown, expired or revoked access token')
  await rateLimitRefund(key, windowMs)
  await touch(row.token)
  return user
}

// ── the MCP tools calling the admin's routes, inside this process ──────────────

export const MCP_INTERNAL_HEADER = 'x-tinyzoo-mcp'
// A secret of this process: a request from outside cannot know it.
const PROCESS_KEY = randomBytes(32).toString('base64url')

/** The header value for an internal request made with this token. */
export const mcpInternalValue = (tokenId: string) => `${PROCESS_KEY}.${tokenId}`

/**
 * The admin routes an access token reaches through the MCP tools: entries, globals, the media
 * library, search and link lookups. Never accounts, people, privacy, previews or the sockets.
 */
const MCP_SYSTEM_ROUTES = new Set(['_singleton', '_media', '_search', '_links'])
export function mcpRouteAllowed(path: string): boolean {
  const m = /^\/api\/cms\/([^/?]+)/.exec(path)
  if (!m) return false
  const first = decodeURIComponent(m[1]!)
  return !first.startsWith('_') || MCP_SYSTEM_ROUTES.has(first)
}

/** The token's user for an internal request (`x-tinyzoo-mcp`), or null when the header is not ours or the token no longer works. */
export async function mcpInternalUser(value: string): Promise<CmsUser | null> {
  const dot = value.lastIndexOf('.')
  if (dot < 0) return null
  const key = Buffer.from(value.slice(0, dot))
  const ours = Buffer.from(PROCESS_KEY)
  if (key.length !== ours.length || !timingSafeEqual(key, ours)) return null
  const id = value.slice(dot + 1)
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { db, reg } = useCms()
  const t = reg.cmsAccessTokens
  const [row] = await db.select({ token: t, account: reg.cmsUsers }).from(t).innerJoin(reg.cmsUsers, eq(reg.cmsUsers.id, t.userId)).where(eq(t.id, id))
  return row && usable(row.token) ? userOfToken(row.token, row.account) : null
}

// ── managing tokens (the account page) ─────────────────────────────────────────

/** Whether the MCP server is on (`cms.mcp.enabled`, NUXT_CMS_MCP_ENABLED; default on). */
export function cmsMcpEnabled(): boolean {
  const v = (useRuntimeConfig().cms as any)?.mcp?.enabled
  return v !== false && v !== 'false'
}

/**
 * The signed-in person who manages their own tokens: built-in sign-in, the MCP server on, a
 * session (a token cannot make tokens) and not the shared demo account.
 */
export function requireTokenOwner(event: any): CmsUser {
  assertBuiltinAuth()
  if (!cmsMcpEnabled()) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const user = requireCmsUser(event)
  if (user.token) throw createError({ statusCode: 403, statusMessage: 'Sign in to manage access tokens' })
  if (isDemoAccount(user.email)) throw createError({ statusCode: 403, statusMessage: 'The demo account cannot make access tokens' })
  return user
}

export const MAX_TOKENS_PER_PERSON = 20
