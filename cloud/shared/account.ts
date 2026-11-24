// The pure parts of the account service: the cloud app as the issuer of sign-in for websites
// (docs/multi-tenant-plan.md, 2.15). Addresses, the checks on what a website sends, and the
// few values both the pages and the server need. Nothing here touches a database or a
// request, so all of it is covered by unit specs.

/** Where a website receives the answer of a sign-in: its address followed by this path, and nothing else. */
export const CALLBACK_PATH = '/api/cms/_auth/account/callback'
/** Where a website starts a sign-in through the account. */
export const START_PATH = '/api/cms/_auth/account/start'
/** A one-time code works for a minute, never longer. */
export const CODE_TTL_SECONDS = 60

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/** A host name that is this machine: localhost, anything under .localhost, the loopback addresses. */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '[::1]'
}

/**
 * A website's address as its client keeps it: scheme, host and port, nothing after them.
 * https, or http for a website on this machine. A bare host name is taken as https (http on
 * this machine). Null for anything else: a path, a query, a login, another scheme.
 */
export function clientAddress(input: unknown): string | null {
  let text = typeof input === 'string' ? input.trim() : ''
  if (!text || text.length > 300 || /[\s\\]/.test(text)) return null
  if (!HAS_SCHEME.test(text)) text = `${isLocalHost(text.split(/[/:?#]/)[0] ?? '') ? 'http' : 'https'}://${text}`
  let url: URL
  try { url = new URL(text) }
  catch { return null }
  if (url.username || url.password || url.search || url.hash || text.includes('?') || text.includes('#') || text.includes('@')) return null
  if (url.pathname !== '/' && url.pathname !== '') return null
  if (!url.hostname || (!url.hostname.includes('.') && !isLocalHost(url.hostname))) return null
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHost(url.hostname))) return null
  return url.origin
}

/** The one address a client's sign-in may come back to. */
export const callbackOf = (address: string): string => `${address}${CALLBACK_PATH}`

/** Whether `redirectUri` is exactly the client's address followed by the callback path. A client without an address has none. */
export function redirectAllowed(address: string | null | undefined, redirectUri: unknown): boolean {
  return typeof redirectUri === 'string' && !!address && redirectUri === callbackOf(address)
}

/** `redirectUri` with the answer's values as its query. */
export function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri)
  for (const [name, value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(name, value)
  return url.toString()
}

/** A website's admin, entered through the account: the site sends the browser here and the account sends it back signed in. */
export const adminThroughAccount = (address: string): string => `${address.replace(/\/+$/, '')}${START_PATH}?next=/admin`

/**
 * Where to go after signing in: a path of this app, or null. Never another website: no scheme,
 * no host (`//x`), no backslash (browsers read `/\x` as `//x`), no control character (browsers
 * drop a tab or a line break, which would turn `/<tab>/x` into `//x`).
 */
export function returnPath(next: unknown): string | null {
  if (typeof next !== 'string' || !next || next.length > 4000) return null
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(next)) return null
  try {
    const url = new URL(next, 'http://app.invalid')
    if (url.origin !== 'http://app.invalid') return null
    return `${url.pathname}${url.search}${url.hash}`
  }
  catch {
    return null
  }
}

/** A path the server answers itself (the pages' router does not know it): the browser must ask for it for real. */
export const isServerPath = (path: string): boolean => path === '/oauth/authorize' || path.startsWith('/oauth/authorize?')

/** A PKCE challenge of the S256 method: the base64url of a SHA-256, always 43 characters. */
export const isPkceChallenge = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
/** A PKCE verifier (RFC 7636): 43 to 128 unreserved characters. */
export const isPkceVerifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value)

/** How long a code works, in milliseconds: the setting when it is a shorter time (the checks use one), else a minute. */
export function codeTtlMs(value: unknown): number {
  const seconds = Number(value)
  if (value === '' || value === null || value === undefined || !Number.isFinite(seconds) || seconds <= 0) return CODE_TTL_SECONDS * 1000
  return Math.round(Math.min(seconds, CODE_TTL_SECONDS) * 1000)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** An id of the issuer (a client's, a person's): a lower-case uuid. */
export const isAccountId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

/** `Authorization: Basic base64(id:secret)` → the two parts, or null. The secret may hold a colon; the id may not. */
export function parseBasicAuth(header: unknown): { id: string; secret: string } | null {
  if (typeof header !== 'string') return null
  const match = /^Basic\s+([A-Za-z0-9+/_=-]+)\s*$/i.exec(header)
  if (!match) return null
  let text: string
  try { text = atob(match[1]!.replace(/-/g, '+').replace(/_/g, '/')) }
  catch { return null }
  const at = text.indexOf(':')
  if (at < 1 || at === text.length - 1) return null
  return { id: text.slice(0, at), secret: text.slice(at + 1) }
}

/** The role a website reports for a person, as the issuer keeps it for showing: a short plain text, or null. */
export function memberRole(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const role = value.trim()
  if (!role || role.length > 60 || /[\u0000-\u001f\u007f<>]/.test(role)) return null
  return role
}

/** The three settings a website needs to sign people in through the account, as the lines of its environment. */
export function accountEnvLines(credentials: { issuer: string; clientId: string; clientSecret: string }): string {
  return [
    `NUXT_CMS_AUTH_ACCOUNT_ISSUER=${credentials.issuer}`,
    `NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID=${credentials.clientId}`,
    `NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET=${credentials.clientSecret}`,
  ].join('\n')
}
