// A site that moved to another address: page requests on its old host names are sent to the
// public address, with the same path and query. Pure, so the server middleware and the tests
// share it. The API, build assets and /.well-known stay where they are: programs that call the
// old address (a monitor with its token, an MCP client) would lose their Authorization header
// on a redirect to another origin.

const STAY = ['/api/', '/_nuxt/', '/__nuxt', '/_ipx/', '/.well-known/']

/** A host name in lower case, without its port. */
export function hostName(value: unknown): string {
  let host = String(value ?? '').trim().toLowerCase()
  if (!host) return ''
  const bracket = host.startsWith('[') ? host.indexOf(']') : -1
  if (bracket > 0) return host.slice(0, bracket + 1)
  const colon = host.lastIndexOf(':')
  if (colon > 0) host = host.slice(0, colon)
  return host
}

/** `cms.redirectHosts`: a list, or one text with commas (NUXT_CMS_REDIRECT_HOSTS). */
export function redirectHostList(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(',')
  return [...new Set(parts.map(hostName).filter(Boolean))]
}

/**
 * Where a request goes instead, or null when it is answered here. Only GET and HEAD, only on a
 * host of the list, never to the host the request already came to.
 */
export function hostRedirectTarget(input: { method: string; url: string; host: unknown; publicUrl: string; redirectHosts: string[] }): string | null {
  const method = String(input.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return null
  const host = hostName(input.host)
  if (!host || !input.redirectHosts.includes(host)) return null
  let target: URL
  try {
    target = new URL(input.publicUrl)
  }
  catch {
    return null
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return null
  if (hostName(target.host) === host) return null
  const url = input.url.startsWith('/') ? input.url : '/'
  const path = url.split('?')[0]!
  if (STAY.some((prefix) => path.startsWith(prefix))) return null
  return input.publicUrl.replace(/\/+$/, '') + url
}
