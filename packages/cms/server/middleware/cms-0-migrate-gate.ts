// While start-up migrations run, API requests wait for them (a fresh pod can accept
// connections before the schema is ready); if they failed, the API answers 503
// instead of running against a half-migrated database. Health checks pass through.
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/') || path.startsWith('/api/health/')) return
  try {
    await cmsMigrationsReady()
  }
  catch {
    throw createError({ statusCode: 503, statusMessage: 'Database migrations failed — see the server log' })
  }
})
