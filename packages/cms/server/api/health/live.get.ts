// GET /api/health/live — the process is up (liveness).
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return { ok: true }
})
