import pkg from '../../../package.json'

// GET /api/cms/_about — what the admin's About page shows: the tinyzoo version the site runs,
// since when this server runs, Node.js, the database migrations and the plugins. For anyone
// signed in (a version is what support asks for first); no content, no personal data.
export default defineEventHandler((event) => {
  requireCmsAccount(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const { reg } = useCms()
  return {
    tinyzoo: pkg.version,
    node: typeof process !== 'undefined' && process.version ? process.version : null,
    startedAt: cmsStartedAt().toISOString(),
    migrations: cmsMigrationState(),
    plugins: reg.plugins.map((p) => ({ name: p.name, version: p.version })),
  }
})
