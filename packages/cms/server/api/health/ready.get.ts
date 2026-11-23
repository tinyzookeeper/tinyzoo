import { sql } from 'tinyzoo'

// GET /api/health/ready — ready for traffic (readiness): migrations done (when run at
// start) and the database answers. 503 otherwise.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  // Multi-tenant mode, asked by IP: the process takes traffic. Asked by a site's host name: that site is ready.
  if (!currentSite()) return { ok: true, sites: cmsAllSites().length }
  const migrations = cmsMigrationState()
  if (migrations === 'running' || migrations === 'failed') {
    setResponseStatus(event, 503)
    return { ok: false, migrations }
  }
  try {
    const { db } = useCms()
    await db.execute(sql`select 1`)
    return { ok: true, migrations }
  }
  catch {
    setResponseStatus(event, 503)
    return { ok: false, database: 'unreachable' }
  }
})
