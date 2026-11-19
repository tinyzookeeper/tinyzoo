import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, isNull, lt, notExists, or, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import {
  OAUTH_ACCESS_TTL_MS, OAUTH_CODE_TTL_MS, OAUTH_REFRESH_TTL_MS, OAUTH_REQUEST_TTL_MS, OAUTH_SCOPES,
  clientDisplayName, isAllowedRedirectUri, resourceMatches, scopeString,
} from '#keeper/oauth'

/**
 * Keeper as an OAuth 2.1 authorization server for its own MCP server (see `#keeper/oauth` for
 * the rules): discovery (RFC 8414, RFC 9728), open client registration (RFC 7591), the
 * authorization code flow with PKCE (S256 only), refresh tokens and revocation (RFC 7009).
 *
 * A connection is a row of `tokens` (origin `oauth`), so it is listed and revoked in Settings
 * like a token made by hand, and `/mcp` checks it the same way. Codes, access and refresh tokens
 * are kept only as SHA-256. Adapted from Postyard (server/utils/mcpOAuth.ts).
 *
 * The refresh token is deliberately not rotated: an MCP client refreshes from several calls at
 * once when the access token expires, and rotation would strand all but one of them. Instead it
 * is hashed, reaches only the token endpoint, expires 60 days after its last use, and dies with
 * the connection.
 */

/** Keeper's own address: NUXT_PUBLIC_URL, or the address the request came to. */
export function keeperBaseUrl(event: H3Event): string {
  const configured = String(useRuntimeConfig().publicUrl || '').replace(/\/+$/, '')
  return configured || getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
}

export const mcpResourceUrl = (event: H3Event) => `${keeperBaseUrl(event)}/mcp`

export function authorizationServerMetadata(event: H3Event) {
  const issuer = keeperBaseUrl(event)
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    scopes_supported: OAUTH_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // S256 alone: `plain` would let a client opt out of PKCE's protection.
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
  }
}

export function protectedResourceMetadata(event: H3Event) {
  return {
    resource: mcpResourceUrl(event),
    authorization_servers: [keeperBaseUrl(event)],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Keeper',
  }
}

/** The 401 of `/mcp` says where the sign-in starts. */
export const mcpWwwAuthenticate = (event: H3Event) =>
  `Bearer realm="keeper", resource_metadata="${keeperBaseUrl(event)}/.well-known/oauth-protected-resource/mcp"`

// ── failures in OAuth's own shape (RFC 6749 §5.2) ───────────────────────────────

export interface OAuthFailure extends Error { oauth: { code: string; description: string; status: number } }

export function oauthFailure(code: string, description: string, status = 400): OAuthFailure {
  return Object.assign(new Error(description), { oauth: { code, description, status } })
}
export const isOAuthFailure = (e: unknown): e is OAuthFailure => !!e && typeof e === 'object' && 'oauth' in e

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

// ── registration ────────────────────────────────────────────────────────────────

export async function registerClient(input: { name: string; redirectUris: string[]; clientUri?: string | null }) {
  const redirectUris = [...new Set(input.redirectUris.map((u) => u.trim()).filter(Boolean))]
  if (!redirectUris.length) throw oauthFailure('invalid_redirect_uri', 'At least one redirect_uri is required')
  if (redirectUris.length > 10) throw oauthFailure('invalid_redirect_uri', 'Too many redirect URIs')
  const bad = redirectUris.find((u) => !isAllowedRedirectUri(u))
  if (bad) throw oauthFailure('invalid_redirect_uri', `"${bad}" cannot receive an authorization code: use https, http on loopback, or an app's own scheme, without a fragment.`)
  void sweepExpired()
  const [row] = await useDb().insert(schema.oauthClients)
    .values({ name: clientDisplayName(input.name), redirectUris, clientUri: input.clientUri ?? null })
    .returning()
  return row!
}

export async function loadClient(clientId: string) {
  if (!isUuid(clientId)) return null
  const [row] = await useDb().select().from(schema.oauthClients).where(eq(schema.oauthClients.id, clientId))
  return row ?? null
}

// ── authorization: written down, then decided on the consent page ───────────────

export async function createAuthorizationRequest(input: { clientId: string; redirectUri: string; state: string | null; codeChallenge: string; scope: 'read' | 'write'; resource: string | null }): Promise<string> {
  const [row] = await useDb().insert(schema.oauthRequests)
    .values({ ...input, expiresAt: new Date(Date.now() + OAUTH_REQUEST_TTL_MS) })
    .returning({ id: schema.oauthRequests.id })
  return row!.id
}

/** A request still waiting for a decision, with what the consent page shows. */
export async function loadPendingRequest(id: string) {
  if (!isUuid(id)) return null
  const [row] = await useDb().select({
    id: schema.oauthRequests.id, redirectUri: schema.oauthRequests.redirectUri, scope: schema.oauthRequests.scope,
    decidedAt: schema.oauthRequests.decidedAt, expiresAt: schema.oauthRequests.expiresAt,
    clientName: schema.oauthClients.name, clientUri: schema.oauthClients.clientUri,
  }).from(schema.oauthRequests)
    .innerJoin(schema.oauthClients, eq(schema.oauthClients.id, schema.oauthRequests.clientId))
    .where(eq(schema.oauthRequests.id, id))
  if (!row || row.decidedAt || row.expiresAt.getTime() <= Date.now()) return null
  return row
}

/** Take a request for a decision, once. */
async function claimRequest(id: string) {
  if (!isUuid(id)) return null
  const [row] = await useDb().update(schema.oauthRequests).set({ decidedAt: new Date() })
    .where(and(eq(schema.oauthRequests.id, id), isNull(schema.oauthRequests.decidedAt))).returning()
  return row && row.expiresAt.getTime() > Date.now() ? row : null
}

export function buildRedirect(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) url.searchParams.set(k, v)
  return url.toString()
}

/** Approve: never more than the client asked for (it may get read where it asked for write). */
export async function approveRequest(input: { requestId: string; member: SignedInMember; name: string; scope: 'read' | 'write' }): Promise<string> {
  const request = await claimRequest(input.requestId)
  if (!request) throw oauthFailure('invalid_request', 'This request is no longer open', 410)
  const scope = request.scope === 'write' ? input.scope : 'read'
  const code = randomBytes(32).toString('base64url')
  await useDb().insert(schema.oauthCodes).values({
    codeHash: sha256(code), clientId: request.clientId, workspaceId: input.member.workspaceId, userId: input.member.userId,
    redirectUri: request.redirectUri, codeChallenge: request.codeChallenge, resource: request.resource,
    scope, name: input.name, expiresAt: new Date(Date.now() + OAUTH_CODE_TTL_MS),
  })
  return buildRedirect(request.redirectUri, { code, state: request.state })
}

export async function denyRequest(requestId: string): Promise<string> {
  const request = await claimRequest(requestId)
  if (!request) throw oauthFailure('invalid_request', 'This request is no longer open', 410)
  return buildRedirect(request.redirectUri, { error: 'access_denied', error_description: 'The request was declined', state: request.state })
}

// ── tokens ──────────────────────────────────────────────────────────────────────

export interface TokenResponse { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string }

const REFRESH_PREFIX = 'kprr_'

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false
  const expected = createHash('sha256').update(verifier).digest()
  const given = Buffer.from(challenge, 'base64url')
  return given.length === expected.length && timingSafeEqual(expected, given)
}

/** A code for tokens. Everything is checked first; the code is claimed only then (atomically). */
export async function exchangeCode(input: { code: string; clientId: string; redirectUri: string | null; codeVerifier: string; resource: string | null; canonicalResource: string }): Promise<TokenResponse> {
  const db = useDb()
  const codeHash = sha256(input.code)
  const [row] = await db.select().from(schema.oauthCodes).where(eq(schema.oauthCodes.codeHash, codeHash))
  if (!row || row.consumedAt) throw oauthFailure('invalid_grant', 'This authorization code is not valid')
  if (row.expiresAt.getTime() <= Date.now()) throw oauthFailure('invalid_grant', 'This authorization code has expired')
  if (row.clientId !== input.clientId) throw oauthFailure('invalid_grant', 'This code was issued to another client')
  if (input.redirectUri !== null && input.redirectUri !== row.redirectUri) throw oauthFailure('invalid_grant', 'redirect_uri does not match the authorization request')
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) throw oauthFailure('invalid_grant', 'The PKCE verifier does not match the challenge')
  if (!resourceMatches(input.resource, input.canonicalResource)) throw oauthFailure('invalid_target', 'This server does not issue tokens for that resource')
  const [claimed] = await db.update(schema.oauthCodes).set({ consumedAt: new Date() })
    .where(and(eq(schema.oauthCodes.codeHash, codeHash), isNull(schema.oauthCodes.consumedAt))).returning({ id: schema.oauthCodes.id })
  if (!claimed) throw oauthFailure('invalid_grant', 'This authorization code has already been used')

  const access = generateToken()
  const refresh = REFRESH_PREFIX + randomBytes(32).toString('base64url')
  const now = Date.now()
  await db.insert(schema.tokens).values({
    workspaceId: row.workspaceId, createdBy: row.userId, name: row.name, scope: row.scope,
    hash: access.hash, prefix: access.prefix, origin: 'oauth', clientId: row.clientId,
    accessExpiresAt: new Date(now + OAUTH_ACCESS_TTL_MS), refreshHash: sha256(refresh), refreshExpiresAt: new Date(now + OAUTH_REFRESH_TTL_MS),
  })
  void db.update(schema.oauthClients).set({ lastUsedAt: new Date() }).where(eq(schema.oauthClients.id, row.clientId)).catch(() => {})
  return { access_token: access.token, token_type: 'Bearer', expires_in: OAUTH_ACCESS_TTL_MS / 1000, refresh_token: refresh, scope: scopeString(row.scope) }
}

/** A refresh token for a new access token. The refresh token stays, and lives 60 days from now. */
export async function refreshAccess(input: { refreshToken: string; clientId: string | null }): Promise<TokenResponse> {
  const db = useDb()
  const [row] = await db.select().from(schema.tokens)
    .where(and(eq(schema.tokens.refreshHash, sha256(input.refreshToken)), eq(schema.tokens.origin, 'oauth'), isNull(schema.tokens.revokedAt)))
  if (!row) throw oauthFailure('invalid_grant', 'This refresh token is not valid')
  if (row.refreshExpiresAt && row.refreshExpiresAt.getTime() <= Date.now()) throw oauthFailure('invalid_grant', 'This connection has expired: sign in again')
  if (input.clientId && row.clientId && row.clientId !== input.clientId) throw oauthFailure('invalid_grant', 'This refresh token was issued to another client')
  const access = generateToken()
  const now = Date.now()
  await db.update(schema.tokens).set({
    hash: access.hash, prefix: access.prefix, accessExpiresAt: new Date(now + OAUTH_ACCESS_TTL_MS),
    refreshExpiresAt: new Date(now + OAUTH_REFRESH_TTL_MS), lastUsedAt: new Date(now),
  }).where(eq(schema.tokens.id, row.id))
  return { access_token: access.token, token_type: 'Bearer', expires_in: OAUTH_ACCESS_TTL_MS / 1000, refresh_token: input.refreshToken, scope: scopeString(row.scope) }
}

/** Revoke a connection by its access or its refresh token (RFC 7009: the answer never says which, or whether). */
export async function revokeSecret(raw: string): Promise<void> {
  const hash = sha256(raw)
  await useDb().update(schema.tokens).set({ revokedAt: new Date() })
    .where(and(eq(schema.tokens.origin, 'oauth'), isNull(schema.tokens.revokedAt), or(eq(schema.tokens.hash, hash), eq(schema.tokens.refreshHash, hash))))
}

/**
 * Leftovers: requests and codes a day past their end, and registrations over a month old that
 * no connection uses (the one table anyone can grow without signing in).
 */
async function sweepExpired(): Promise<void> {
  const db = useDb()
  const cutoff = new Date(Date.now() - 86_400_000)
  try {
    await db.delete(schema.oauthRequests).where(lt(schema.oauthRequests.expiresAt, cutoff))
    await db.delete(schema.oauthCodes).where(lt(schema.oauthCodes.expiresAt, cutoff))
    await db.delete(schema.oauthClients).where(and(
      lt(schema.oauthClients.createdAt, new Date(Date.now() - 30 * 86_400_000)),
      notExists(db.select({ one: sql`1` }).from(schema.tokens).where(eq(schema.tokens.clientId, schema.oauthClients.id))),
    ))
  }
  catch (err: any) {
    console.error('[keeper] oauth sweep failed', err?.message ?? err)
  }
}
