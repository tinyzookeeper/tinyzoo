// The cloud app moved to another address (NUXT_REDIRECT_HOSTS, host names separated by commas): a page
// asked for on one of its old host names is sent to NUXT_PUBLIC_URL, for good (301), with the
// same path and query. The API and the
// account service's own routes (/oauth, /.well-known) still answer on the old name: a website's
// server that calls them proves itself in the request, and a redirect to another origin would lose that.
const STAY = ['/api/', '/oauth/', '/.well-known/', '/_nuxt/', '/__nuxt']

const hostName = (value: unknown): string => {
  const host = String(value ?? '').trim().toLowerCase()
  const colon = host.startsWith('[') ? -1 : host.lastIndexOf(':')
  return colon > 0 ? host.slice(0, colon) : host
}

export default defineEventHandler((event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const config = useRuntimeConfig()
  const old = String(config.redirectHosts || '').split(',').map(hostName).filter(Boolean)
  if (!old.length) return
  const req = event.node.req
  // The name the visitor asked for: a proxy that rewrites Host says it in X-Forwarded-Host.
  const host = hostName(String(req.headers['x-forwarded-host'] || '').split(',')[0] || req.headers.host)
  if (!host || !old.includes(host)) return
  let target: URL
  try {
    target = new URL(String(config.publicUrl || ''))
  }
  catch {
    return
  }
  if (hostName(target.host) === host) return
  const url = String(req.url || '/')
  const path = url.split('?')[0]!
  if (!url.startsWith('/') || STAY.some((prefix) => path.startsWith(prefix))) return
  return sendRedirect(event, target.origin + url, 301)
})
