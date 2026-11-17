// The documentation's table of contents in a website language: GET /api/site-docs/nav?lang=en.
export default defineEventHandler(async (event) => {
  const nav = await docsNav(docsLang(getQuery(event).lang))
  if (!nav) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setHeader(event, 'cache-control', 'public, max-age=300')
  return nav
})
