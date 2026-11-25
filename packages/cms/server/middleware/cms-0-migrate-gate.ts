// While start-up migrations run, API requests wait for them (a fresh pod can accept
// connections before the schema is ready); if they failed, the API answers 503
// instead of running against a half-migrated database. Health checks pass through.
// A site with its own content types (multi-tenant mode) also waits for them to be read
// (cmsSiteReady); when they cannot be read, the request answers 503 and the next one tries again.
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  // Health checks and framework endpoints (/api/_nuxt_icon, /api/_auth/session) pass.
  if (!path.startsWith('/api/') || path.startsWith('/api/health/') || path.startsWith('/api/_')) return
  try {
    await cmsSiteReady()
  }
  catch (err) {
    if (cmsIsModelLoadError(err)) throw createError({ statusCode: 503, statusMessage: 'The site\'s content types could not be read; try again shortly' })
    throw createError({ statusCode: 503, statusMessage: 'Database migrations failed; see the server log' })
  }
})
