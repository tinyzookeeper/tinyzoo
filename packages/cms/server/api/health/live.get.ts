// GET /api/health/live — the process is up (liveness). Fails once start-up
// migrations gave up, so a platform that probes it restarts the instance.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  // Multi-tenant mode, asked by IP (the platform's probe): the process is up. One site's
  // failed migration is that site's state, not a reason to restart every site.
  if (!currentSite()) return { ok: true }
  if (cmsMigrationState() === 'failed') {
    setResponseStatus(event, 503)
    return { ok: false, migrations: 'failed' }
  }
  return { ok: true }
})
