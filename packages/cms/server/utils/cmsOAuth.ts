import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, isNull, lt, or, sql } from 'tinyzoo'

/**
 * The site as an OAuth 2.1 authorization server for its MCP server (`/api/mcp`): discovery
 * (RFC 8414, RFC 9728), open client registration (RFC 7591), the authorization code flow with
 * PKCE (S256 only), refresh tokens and revocation (RFC 7009). The rules are in cmsOAuthRules.ts.
 *
 * The person decides on the admin's connect page (`/admin/connect`), with the same rights a
 * token made by hand gets (CmsTokenRights, never more than the role). A connection is a row of
 * cms_access_tokens with origin `oauth`: listed and revoked on the account page like any token,
 * and checked by `/api/mcp` the same way. Codes and tokens are kept only as SHA-256.
 *
 * The refresh token is deliberately not rotated: an MCP client refreshes from several calls at
 * once when the access token expires, and rotation would strand all but one. It is hashed, reaches
 * only the token endpoint, expires 60 days after its last use, and dies with the connection.
 */

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REFRESH_PREFIX = 'tzpr_'

/** The site's own address: `cms.publicUrl`, or the address the request came to (never in multi-tenant mode: a site always has its address). */
export function cmsMcpBaseUrl(event: any): string {
  const configured = String(cmsSettings().publicUrl || '').trim().replace(/\/+$/, '')
  if (configured || cmsIsMultiTenant()) return configured
  return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
}

export const cmsMcpResourceUrl = (event: any) => `${cmsMcpBaseUrl(event)}/api/mcp`

/** OAuth is there when the MCP server is: built-in sign-in, `cms.mcp` on. */
export function assertCmsOAuth(): void {
  if (cmsAuthMode() !== 'builtin' || !cmsMcpEnabled()) throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

export function cmsOAuthServerMetadata(event: any) {
  const issuer = cmsMcpBaseUrl(event)
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
    scopes_supported: CMS_OAUTH_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // S256 alone: `plain` would let a client opt out of PKCE's protection.
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
  }
}

export function cmsOAuthResourceMetadata(event: any) {
  return {
    resource: cmsMcpResourceUrl(event),
    authorization_servers: [cmsMcpBaseUrl(event)],
    scopes_supported: CMS_OAUTH_SCOPES,
    bearer_methods_supported: ['header'],
  }
}

/** The 401 of `/api/mcp` says where the sign-in starts (RFC 9728). */
export const cmsMcpWwwAuthenticate = (event: any) =>
  `Bearer realm="tinyzoo", resource_metadata="${cmsMcpBaseUrl(event)}/.well-known/oauth-protected-resource/api/mcp"`

// ── failures in OAuth's own shape (RFC 6749 §5.2) ───────────────────────────────

export interface CmsOAuthFailure extends Error { oauth: { code: string; description: string; status: number } }
export const cmsOAuthFailure = (code: string, description: string, status = 400): CmsOAuthFailure =>
  Object.assign(new Error(description), { oauth: { code, description, status } })
export const isCmsOAuthFailure = (e: unknown): e is CmsOAuthFailure => !!e && typeof e === 'object' && 'oauth' in e

// ── registration ────────────────────────────────────────────────────────────────

export async function registerOAuthClient(input: { name: string; redirectUris: string[]; clientUri?: string | null }) {
  const redirectUris = [...new Set(input.redirectUris.map((u) => u.trim()).filter(Boolean))]
  if (!redirectUris.length) throw cmsOAuthFailure('invalid_redirect_uri', 'At least one redirect_uri is required')
  if (redirectUris.length > 10) throw cmsOAuthFailure('invalid_redirect_uri', 'Too many redirect URIs')
  const bad = redirectUris.find((u) => !oauthRedirectAllowed(u))
  if (bad) throw cmsOAuthFailure('invalid_redirect_uri', `"${bad}" cannot receive an authorization code: use https, http on loopback, or an app's own scheme, without a fragment.`)
  void sweepOAuth()
  const { db, reg } = useCms()
  const [row] = await db.insert(reg.cmsOauthClients).values({ name: oauthClientName(input.name), redirectUris, clientUri: input.clientUri ?? null }).returning()
  return row as { id: string; name: string; redirectUris: string[]; createdAt: Date }
}

export async function loadOAuthClient(clientId: string) {
  if (!UUID.test(clientId)) return null
  const { db, reg } = useCms()
  const [row] = await db.select().from(reg.cmsOauthClients).where(eq(reg.cmsOauthClients.id, clientId))
  return (row ?? null) as { id: string; name: string; redirectUris: string[] } | null
}

// ── authorization: written down, then decided on the connect page ───────────────

export async function createOAuthRequest(input: { clientId: string; redirectUri: string; state: string | null; codeChallenge: string; scope: 'read' | 'write'; resource: string | null }): Promise<string> {
  const { db, reg } = useCms()
  const [row] = await db.insert(reg.cmsOauthRequests).values({ ...input, expiresAt: new Date(Date.now() + CMS_OAUTH_REQUEST_TTL_MS) }).returning({ id: reg.cmsOauthRequests.id })
  return row!.id
}

/** A request still waiting for its decision, with what the connect page shows. */
export async function loadOAuthRequest(id: string) {
  if (!UUID.test(id)) return null
  const { db, reg } = useCms()
  const r = reg.cmsOauthRequests
  const [row] = await db.select({
    id: r.id, redirectUri: r.redirectUri, scope: r.scope, decidedAt: r.decidedAt, expiresAt: r.expiresAt,
    clientName: reg.cmsOauthClients.name, clientUri: reg.cmsOauthClients.clientUri,
  }).from(r).innerJoin(reg.cmsOauthClients, eq(reg.cmsOauthClients.id, r.clientId)).where(eq(r.id, id))
  if (!row || row.decidedAt || row.expiresAt.getTime() <= Date.now()) return null
  return row as { id: string; redirectUri: string; scope: 'read' | 'write'; clientName: string; clientUri: string | null }
}

async function claimOAuthRequest(id: string) {
  if (!UUID.test(id)) return null
  const { db, reg } = useCms()
  const r = reg.cmsOauthRequests
  const [row] = await db.update(r).set({ decidedAt: new Date() }).where(and(eq(r.id, id), isNull(r.decidedAt))).returning()
  return row && row.expiresAt.getTime() > Date.now() ? row : null
}

export function oauthRedirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) url.searchParams.set(k, v)
  return url.toString()
}

/** Approve with the rights the person chose, held to their role; a client that asked to read only gets no writing. */
export async function approveOAuthRequest(input: { requestId: string; user: CmsUser; name: string; rights: CmsTokenRights }): Promise<string> {
  const rights = clampTokenRights(input.rights, input.user)
  const request = await claimOAuthRequest(input.requestId)
  if (!request) throw cmsOAuthFailure('invalid_request', 'This request is no longer open', 410)
  const granted = request.scope === 'write' ? rights : { ...rights, write: false, publish: false, delete: false, media: false }
  const code = randomBytes(32).toString('base64url')
  const { db, reg } = useCms()
  await db.insert(reg.cmsOauthCodes).values({
    codeHash: sha256(code), clientId: request.clientId, userId: input.user.id, redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge, resource: request.resource, name: input.name, rights: granted,
    expiresAt: new Date(Date.now() + CMS_OAUTH_CODE_TTL_MS),
  })
  return oauthRedirectWith(request.redirectUri, { code, state: request.state })
}

export async function denyOAuthRequest(requestId: string): Promise<string> {
  const request = await claimOAuthRequest(requestId)
  if (!request) throw cmsOAuthFailure('invalid_request', 'This request is no longer open', 410)
  return oauthRedirectWith(request.redirectUri, { error: 'access_denied', error_description: 'The request was declined', state: request.state })
}

// ── tokens ──────────────────────────────────────────────────────────────────────

export interface CmsOAuthTokens { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string }

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false
  const expected = createHash('sha256').update(verifier).digest()
  const given = Buffer.from(challenge, 'base64url')
  return given.length === expected.length && timingSafeEqual(expected, given)
}

const scopeOf = (rights: CmsTokenRights) => oauthScopeString(rights.write ? 'write' : 'read')

/** A code for tokens: everything checked first, the code claimed only then (atomically). */
export async function exchangeOAuthCode(input: { code: string; clientId: string; redirectUri: string | null; codeVerifier: string; resource: string | null; canonicalResource: string }): Promise<CmsOAuthTokens> {
  const { db, reg } = useCms()
  const c = reg.cmsOauthCodes
  const codeHash = sha256(input.code)
  const [row] = await db.select().from(c).where(eq(c.codeHash, codeHash))
  if (!row || row.consumedAt) throw cmsOAuthFailure('invalid_grant', 'This authorization code is not valid')
  if (row.expiresAt.getTime() <= Date.now()) throw cmsOAuthFailure('invalid_grant', 'This authorization code has expired')
  if (row.clientId !== input.clientId) throw cmsOAuthFailure('invalid_grant', 'This code was issued to another client')
  if (input.redirectUri !== null && input.redirectUri !== row.redirectUri) throw cmsOAuthFailure('invalid_grant', 'redirect_uri does not match the authorization request')
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) throw cmsOAuthFailure('invalid_grant', 'The PKCE verifier does not match the challenge')
  if (!oauthResourceMatches(input.resource, input.canonicalResource)) throw cmsOAuthFailure('invalid_target', 'This server does not issue tokens for that resource')
  const [claimed] = await db.update(c).set({ consumedAt: new Date() }).where(and(eq(c.codeHash, codeHash), isNull(c.consumedAt))).returning({ id: c.id })
  if (!claimed) throw cmsOAuthFailure('invalid_grant', 'This authorization code has already been used')

  const access = generateAccessToken()
  const refresh = REFRESH_PREFIX + randomBytes(32).toString('base64url')
  const now = Date.now()
  const [token] = await db.insert(reg.cmsAccessTokens).values({
    userId: row.userId, name: row.name, tokenHash: access.hash, prefix: access.prefix, rights: row.rights,
    origin: 'oauth', clientId: row.clientId, accessExpiresAt: new Date(now + CMS_OAUTH_ACCESS_TTL_MS),
    refreshHash: sha256(refresh), refreshExpiresAt: new Date(now + CMS_OAUTH_REFRESH_TTL_MS),
  }).returning({ id: reg.cmsAccessTokens.id })
  await audit(null, 'token.create', { userId: row.userId, recordId: token!.id, meta: { name: row.name, rights: row.rights, via: 'oauth' } })
  void db.update(reg.cmsOauthClients).set({ lastUsedAt: new Date() }).where(eq(reg.cmsOauthClients.id, row.clientId)).catch(() => {})
  return { access_token: access.token, token_type: 'Bearer', expires_in: CMS_OAUTH_ACCESS_TTL_MS / 1000, refresh_token: refresh, scope: scopeOf(row.rights as CmsTokenRights) }
}

/** A refresh token for a new access token; the refresh token stays, and lives 60 days from now. */
export async function refreshOAuthAccess(input: { refreshToken: string; clientId: string | null }): Promise<CmsOAuthTokens> {
  const { db, reg } = useCms()
  const t = reg.cmsAccessTokens
  const [row] = await db.select().from(t).where(and(eq(t.refreshHash, sha256(input.refreshToken)), eq(t.origin, 'oauth'), isNull(t.revokedAt)))
  if (!row) throw cmsOAuthFailure('invalid_grant', 'This refresh token is not valid')
  if (row.refreshExpiresAt && row.refreshExpiresAt.getTime() <= Date.now()) throw cmsOAuthFailure('invalid_grant', 'This connection has expired: sign in again')
  if (input.clientId && row.clientId && row.clientId !== input.clientId) throw cmsOAuthFailure('invalid_grant', 'This refresh token was issued to another client')
  const access = generateAccessToken()
  const now = Date.now()
  await db.update(t).set({
    tokenHash: access.hash, prefix: access.prefix, accessExpiresAt: new Date(now + CMS_OAUTH_ACCESS_TTL_MS),
    refreshExpiresAt: new Date(now + CMS_OAUTH_REFRESH_TTL_MS), lastUsedAt: new Date(now),
  }).where(eq(t.id, row.id))
  return { access_token: access.token, token_type: 'Bearer', expires_in: CMS_OAUTH_ACCESS_TTL_MS / 1000, refresh_token: input.refreshToken, scope: scopeOf(row.rights as CmsTokenRights) }
}

/** Revoke a connection by its access or refresh token (RFC 7009: the answer never says whether it existed). */
export async function revokeOAuthSecret(raw: string): Promise<void> {
  const { db, reg } = useCms()
  const t = reg.cmsAccessTokens
  const hash = sha256(raw)
  await db.update(t).set({ revokedAt: new Date() }).where(and(eq(t.origin, 'oauth'), isNull(t.revokedAt), or(eq(t.tokenHash, hash), eq(t.refreshHash, hash))))
}

/** Requests and codes a day past their end, and registrations over a month old that nothing uses. */
async function sweepOAuth(): Promise<void> {
  const { db, reg } = useCms()
  const cutoff = new Date(Date.now() - 86_400_000)
  try {
    await db.delete(reg.cmsOauthRequests).where(lt(reg.cmsOauthRequests.expiresAt, cutoff))
    await db.delete(reg.cmsOauthCodes).where(lt(reg.cmsOauthCodes.expiresAt, cutoff))
    await db.delete(reg.cmsOauthClients).where(and(
      lt(reg.cmsOauthClients.createdAt, new Date(Date.now() - 30 * 86_400_000)),
      sql`not exists (select 1 from ${reg.cmsAccessTokens} where ${reg.cmsAccessTokens.clientId} = ${reg.cmsOauthClients.id})`,
    ))
  }
  catch (err) {
    console.error('[cms] oauth sweep failed', scrubError(err))
  }
}
