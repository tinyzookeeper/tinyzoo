// Multi-tenant mode: give every request its site, before any middleware or route runs.
//
// The app's handler is replaced by one that looks the request's host up in the site
// directory and runs the original handler inside that site (cmsSite.ts). Nitro wraps the
// handler the same way for its own `asyncContext` option. Requests the app makes to itself
// (server rendering, the MCP tools) go through the same handler: they already run inside
// their caller's site and keep it.
//
// Single mode: this plugin does nothing.
//
// Routes that need no site: the two health checks (the platform's probes arrive by IP) and
// the operator's list of sites, which asks for the operator's token.
const SITELESS = new Set(['/api/health/live', '/api/health/ready', '/api/health/sites'])

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
  // A directory in a file is read now: a missing or broken one fails the start, not the
  // first request. One in a database is read in the background; requests wait for the first read.
  const ready = cmsDirectoryReady().then(() => {
    const count = cmsAllSites().length
    console.info(`[cms] multi-tenant mode: ${count} site${count === 1 ? '' : 's'} in the directory`)
  })
  if (cmsDirectoryLoaded()) cmsAllSites()

  // The sign-in cookie of one site must not be plantable by a script of another site under
  // the same parent domain: the `__Host-` prefix makes browsers refuse a cookie with a Domain.
  const cookie = sessionCookieName()
  if (!cookie.startsWith('__Host-')) {
    console.warn(`[cms] multi-tenant mode: the session cookie is named "${cookie}". Name it with the __Host- prefix `
      + '(NUXT_SESSION_NAME=__Host-tinyzoo) when the sites share a parent domain, so one site cannot set a cookie for another.')
  }

  const handle = nitroApp.h3App.handler
  const route = (event: any) => {
    const req = event.node.req
    const path = String(event.path || req.url || '/').split('?')[0]!
    const host = cmsRequestHost({ host: req.headers.host, forwarded: req.headers['x-forwarded-host'] })
    const ambient = currentCmsSite()
    if (ambient) {
      // A request made from inside a site's work. It stays in that site; a host that names
      // another site is refused.
      if (host && !cmsSiteOwnsHost(ambient, host) && cmsSiteForHost(host)) {
        return Promise.resolve(answer(event, 421, 'This request belongs to another website'))
      }
      // It counts as work of its site by itself: a page may leave one of its own requests running after it was sent.
      const inner = handle(event)
      cmsHoldSiteUntil(inner)
      return inner
    }
    // The operator's route is the process's own whatever host it is asked on: it lists every site.
    if (path === '/api/health/sites') return handle(event)
    const found = host ? cmsSiteForHost(host) : null
    if (!found) {
      if (SITELESS.has(path)) return handle(event)
      return Promise.resolve(answer(event, 404, 'No website at this address'))
    }
    const { site } = found
    if (site.state === 'moved') {
      const target = site.movedTo + String(req.url || '/')
      return Promise.resolve(answer(event, 308, `Moved to ${target}`, { location: target }))
    }
    if (!found.served) {
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
      // Work left running after the response (event.waitUntil) keeps the site's memory until it has finished.
      const platformWaitUntil = event.context.waitUntil
      event.context.waitUntil = (work: unknown) => { cmsHoldSiteUntil(work); platformWaitUntil?.(work) }
      ensureCmsSiteStarted()
      // The first request of a new site may arrive before its database is migrated: pages wait
      // for that as API requests do (cms-0-migrate-gate), instead of asking for tables that are
      // not there yet. A failure is the gate's and the health routes' to report.
      if (path.startsWith('/api/')) return handle(event)
      return cmsMigrationsReady().then(() => handle(event), () => handle(event))
    })
  }
  nitroApp.h3App.handler = (event: any) => {
    if (cmsDirectoryLoaded()) return route(event)
    // The directory is still being read from its database: the liveness probe answers, everything else waits.
    const path = String(event.path || event.node.req.url || '/').split('?')[0]!
    if (path === '/api/health/live') return handle(event)
    return ready.then(() => route(event))
  }

  // Start every site in the background once all plugins have registered their start-up
  // work (migrations, search index, setup code), so the first visitor of a site rarely waits.
  setImmediate(() => {
    void ready.then(() => forEachCmsSite(async () => {
      ensureCmsSiteStarted()
      // A failed migration is that site's own state (it answers 503); the sweep goes on.
      await cmsMigrationsReady().catch(() => {})
    }, { concurrency: 10, what: 'start-up', readOnly: true })).catch((err) => console.error('[cms] the start-up sweep failed:', (err as Error)?.message ?? err))
  })

  // Sites nobody has used for a while give their memory back (NUXT_CMS_TENANCY_IDLE_MINUTES, default 15; 0 = never).
  const idleMinutes = process.env.NUXT_CMS_TENANCY_IDLE_MINUTES === undefined ? 15 : Number(process.env.NUXT_CMS_TENANCY_IDLE_MINUTES)
  const idleMs = Number(process.env.CMS_TEST_TENANCY_IDLE_MS) || idleMinutes * 60_000
  let idleTimer: ReturnType<typeof setInterval> | null = null
  if (idleMs > 0) {
    idleTimer = setInterval(() => {
      try { cmsUnloadIdleSites(idleMs) }
      catch (err) { console.error('[cms] unloading idle sites failed:', (err as Error)?.message ?? err) }
    }, Math.max(250, Math.min(60_000, Math.floor(idleMs / 4))))
    idleTimer.unref?.()
  }

  nitroApp.hooks.hook('close', async () => {
    if (idleTimer) clearInterval(idleTimer)
    await unloadAllCmsSites()
  })
})
