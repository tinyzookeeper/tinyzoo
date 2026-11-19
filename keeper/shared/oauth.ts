/**
 * The rules an OAuth sign-in for the MCP server is decided by, with nothing that can fail.
 *
 * Keeper is its own authorization server: a client given only the address of `/mcp` finds out
 * where to sign in, registers itself, sends a person to the consent page, and gets a short-lived
 * access token and a refresh token. A token made by hand in Settings keeps working beside it.
 *
 * Every function here is a refusal (which redirect may receive a code, which resource a token is
 * for, what a scope means): each is easy to write approximately and dangerous to get
 * approximately right, so they are pure. Adapted from Postyard's `shared/mcpOAuth.ts`.
 */

export const OAUTH_READ = 'mcp:read'
export const OAUTH_WRITE = 'mcp:write'
export const OAUTH_SCOPES = [OAUTH_READ, OAUTH_WRITE]

/** A code lives 5 minutes, an access token an hour, a refresh token 60 days from its last use. */
export const OAUTH_CODE_TTL_MS = 5 * 60_000
export const OAUTH_REQUEST_TTL_MS = 10 * 60_000
export const OAUTH_ACCESS_TTL_MS = 60 * 60_000
export const OAUTH_REFRESH_TTL_MS = 60 * 24 * 60 * 60_000

/** Where a browser is sent to decide about a connection. */
export const OAUTH_CONSENT_PATH = '/oauth/consent'

/** Space-delimited scopes; unknown ones (`openid`, `profile`) are dropped, not refused. */
export function parseScopeParam(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw.split(/[\s+]+/).map((s) => s.trim()).filter((s) => OAUTH_SCOPES.includes(s))
}

/**
 * The most a client asked for. Nothing asked means everything offered (what an omitted `scope`
 * means, and what MCP clients send): a ceiling for the consent page, not a grant.
 */
export function requestedScope(raw: string | null | undefined): 'read' | 'write' {
  const asked = parseScopeParam(raw)
  if (!asked.length) return 'write'
  return asked.includes(OAUTH_WRITE) ? 'write' : 'read'
}

/** A granted scope as OAuth writes it. Write includes read. */
export const scopeString = (scope: 'read' | 'write') => (scope === 'write' ? `${OAUTH_READ} ${OAUTH_WRITE}` : OAUTH_READ)

const FORBIDDEN_SCHEMES = new Set(['javascript', 'data', 'file', 'blob', 'vbscript', 'about'])

/**
 * May a code be sent back to this address? The three kinds of MCP client: an https callback
 * (a hosted client), http on loopback (a local proxy on a random port) and a private-use scheme
 * (a desktop app's `cursor://`). Plain http elsewhere would carry the code in clear text, and a
 * fragment would hide the answer's query from the server it is meant for.
 */
export function redirectUriRefusal(raw: string): 'malformed' | 'forbidden-scheme' | 'insecure-http' | 'has-fragment' | null {
  let url: URL
  try { url = new URL(raw) }
  catch { return 'malformed' }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase()
  if (FORBIDDEN_SCHEMES.has(scheme)) return 'forbidden-scheme'
  if (url.hash) return 'has-fragment'
  if (scheme === 'http' && !isLoopbackHost(url.hostname)) return 'insecure-http'
  return null
}

export const isAllowedRedirectUri = (raw: string) => redirectUriRefusal(raw) === null

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

/**
 * Is this redirect one the client registered? Exact comparison (only a trailing slash is
 * forgiven): an origin or prefix match would hand codes to another path or a look-alike host.
 */
export function redirectUriRegistered(registered: string[], requested: string): boolean {
  const norm = (u: string) => u.replace(/\/+$/, '')
  return registered.some((r) => r === requested || norm(r) === norm(requested))
}

/** Does an RFC 8707 `resource` name this MCP server? Absent is fine: there is only one. */
export function resourceMatches(requested: string | null | undefined, canonical: string): boolean {
  if (!requested) return true
  const norm = (raw: string) => {
    try {
      const url = new URL(raw)
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}`.toLowerCase()
    }
    catch { return null }
  }
  const a = norm(requested)
  return a !== null && a === norm(canonical)
}

/** What to call a client that registered itself: its own name, or "An MCP client". */
export function clientDisplayName(raw: string | null | undefined): string {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ')
  return !name || name.length > 120 ? 'An MCP client' : name
}

/** The host a code would go to, shown on the consent page beside the client's (claimed) name. */
export function redirectHostLabel(raw: string): string {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.host : `${url.protocol}//${url.host}`.replace(/\/+$/, '')
  }
  catch { return raw }
}

/**
 * The endpoints a browser-based MCP client calls from another origin. None reads a cookie (the
 * MCP server takes a bearer token, the OAuth endpoints what is in the request), so they answer
 * `Access-Control-Allow-Origin: *` and never with credentials. The consent endpoints are not
 * among them: they answer for the person signed in.
 */
const PUBLIC_CORS_PATHS = ['/mcp', '/api/oauth/register', '/api/oauth/token', '/api/oauth/revoke']
export function isPublicCorsPath(path: string): boolean {
  const clean = path.split('?')[0] ?? path
  return clean.startsWith('/.well-known/oauth-') || PUBLIC_CORS_PATHS.includes(clean)
}
