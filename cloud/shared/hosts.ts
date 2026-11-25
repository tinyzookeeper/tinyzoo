// The cloud app moved to another address (NUXT_REDIRECT_HOSTS): what a request on one of its
// old host names gets. Pure, so the server middleware and the tests share it.
//
//  - A page goes to the same path and query on NUXT_PUBLIC_URL, for good (301).
//  - GET /oauth/authorize goes there too (302): it is a person's browser on its way through a
//    sign-in, and the request carries all it needs in its address. The sign-in cookie lives on
//    one host name only, so everybody signs in on the new one, also when the website that sent
//    them still holds the old address. The code they come back with is exchanged on either name.
//  - The API, the account service's server-to-server routes (POST /oauth/token, /oauth/sites,
//    /oauth/membership) and /.well-known still answer on the old name: a website's server that
//    calls them proves itself in the request, and a redirect to another origin would lose that.

const STAY = ['/api/', '/oauth/', '/.well-known/', '/_nuxt/', '/__nuxt']
const AUTHORIZE = '/oauth/authorize'

/** A host name in lower case, without its port. */
export function hostName(value: unknown): string {
  const host = String(value ?? '').trim().toLowerCase()
  if (!host) return ''
  const bracket = host.startsWith('[') ? host.indexOf(']') : -1
  if (bracket > 0) return host.slice(0, bracket + 1)
  const colon = host.lastIndexOf(':')
  return colon > 0 ? host.slice(0, colon) : host
}

/** NUXT_REDIRECT_HOSTS: host names separated by commas. */
export function redirectHostList(value: unknown): string[] {
  return [...new Set(String(value ?? '').split(',').map(hostName).filter(Boolean))]
}

export interface OldHostRedirect { to: string; status: 301 | 302 }

/**
 * Where a request goes instead, or null when it is answered here. Only GET and HEAD, only on a
 * host of the list, never to the host the request already came to.
 */
export function oldHostRedirect(input: { method: string; url: string; host: unknown; publicUrl: string; redirectHosts: string[] }): OldHostRedirect | null {
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
  const url = String(input.url || '/')
  if (!url.startsWith('/')) return null
  const path = url.split('?')[0]!
  if (path === AUTHORIZE) return { to: target.origin + url, status: 302 }
  if (STAY.some((prefix) => path.startsWith(prefix))) return null
  return { to: target.origin + url, status: 301 }
}
