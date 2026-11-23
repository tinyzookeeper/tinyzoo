// Multi-tenant mode: give every request its site, before any middleware or route runs.
//
// The app's handler is replaced by one that looks the request's host up in the site
// directory and runs the original handler inside that site (cmsSite.ts). Nitro wraps the
// handler the same way for its own `asyncContext` option. Requests the app makes to itself
// (server rendering, the MCP tools) go through the same handler: they already run inside
// their caller's site and keep it.
//
// Single mode: this plugin does nothing.
const SITELESS = new Set(['/api/health/live', '/api/health/ready'])

function answer(event: any, status: number, text: string, headers: Record<string, string> = {}): void {
  const res = event.node.res
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
  res.end(text)
}

export default defineNitroPlugin((nitroApp) => {
  if (!cmsIsMultiTenant()) return
  // Fail the start, not the first request, when the directory is missing or broken.
  const count = cmsAllSites().length
  console.info(`[cms] multi-tenant mode: ${count} site${count === 1 ? '' : 's'} in the directory`)

  const handle = nitroApp.h3App.handler
  nitroApp.h3App.handler = (event: any) => {
    const req = event.node.req
    const path = String(event.path || req.url || '/').split('?')[0]!
    const host = cmsRequestHost({ host: req.headers.host, forwarded: req.headers['x-forwarded-host'] })
    const ambient = currentCmsSite()
    if (ambient) {
      // A request made from inside a site's work. It stays in that site; a host that names
      // another site is refused.
      if (host && !ambient.hosts.includes(host) && cmsSiteForHost(host)) {
        return Promise.resolve(answer(event, 421, 'This request belongs to another website'))
      }
      return handle(event)
    }
    const found = host ? cmsSiteForHost(host) : null
    if (!found) {
      // The platform's probes arrive by IP: the process answers for itself, with no site.
      if (SITELESS.has(path)) return handle(event)
      return Promise.resolve(answer(event, 404, 'No website at this address'))
    }
    const { site, main } = found
    if (!main) {
      const target = site.publicUrl + String(req.url || '/')
      return Promise.resolve(answer(event, 308, `Moved to ${target}`, { location: target }))
    }
    if (site.state === 'paused') return Promise.resolve(answer(event, 503, 'This website is paused', { 'retry-after': '300' }))
    if (site.state === 'read-only' && !['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || 'GET').toUpperCase())) {
      return Promise.resolve(answer(event, 503, 'This website is read-only for a moment', { 'retry-after': '60' }))
    }
    return runInCmsSite(site, () => {
      event.context.cmsSite = site.id
      // For the pages rendered on the server (canonical addresses): app code cannot call server helpers.
      event.context.cmsPublicUrl = site.publicUrl
      ensureCmsSiteStarted()
      return handle(event)
    })
  }

  // Start every site in the background once all plugins have registered their start-up
  // work (migrations, search index, setup code), so the first visitor of a site rarely waits.
  setImmediate(() => {
    void forEachCmsSite(async () => {
      ensureCmsSiteStarted()
      // A failed migration is that site's own state (it answers 503); the sweep goes on.
      await cmsMigrationsReady().catch(() => {})
    }, { concurrency: 10, what: 'start-up' })
  })
  nitroApp.hooks.hook('close', async () => {
    await unloadAllCmsSites()
  })
})
