// GET /api/health/live — the process is up (liveness). Fails once start-up
// migrations gave up, so a platform that probes it restarts the instance.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (cmsMigrationState() === 'failed') {
    setResponseStatus(event, 503)
    return { ok: false, migrations: 'failed' }
  }
  return { ok: true }
})
