import { timingSafeEqual } from 'node:crypto'

// GET /api/health/sites — multi-tenant mode: every site of this process as the process sees
// it, for whoever runs the service (no content, no secrets). Asked with the operator's
// token (NUXT_CMS_TENANCY_OPERATOR_TOKEN) as `Authorization: Bearer …`; without a token
// configured, or in single mode, the route does not exist (404). It answers on any host,
// also by IP: it belongs to the process, not to a site.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const token = String(process.env.NUXT_CMS_TENANCY_OPERATOR_TOKEN || '')
  if (!cmsIsMultiTenant() || token.length < 16) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const given = String(getRequestHeader(event, 'authorization') || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw createError({ statusCode: 401, statusMessage: 'The operator token is missing or wrong' })

  const sites = cmsSitesOverview().map((row) => {
    const site = cmsSiteById(row.id)
    // Only what a loaded site already knows: looking never loads a site or opens a connection.
    const seen = site ? cmsPeekInSite(site, () => ({ migrations: cmsMigrationState(), connections: cmsSiteConnections() })) : undefined
    return { ...row, migrations: seen?.migrations ?? null, connections: seen?.connections ?? null }
  })
  const memory = process.memoryUsage()
  return {
    sites,
    totals: {
      sites: sites.length,
      loaded: sites.filter((s) => s.loaded).length,
      failedMigrations: sites.filter((s) => s.migrations === 'failed').map((s) => s.id),
      connections: cmsConnectionsInUse(),
      memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed },
      uptimeSeconds: Math.round(process.uptime()),
    },
  }
})
