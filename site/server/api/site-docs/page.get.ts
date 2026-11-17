// One page of the documentation and the table of contents, in a website language:
// GET /api/site-docs/page?lang=cs&section=editors&slug=preklady (no slug: the part's first page).
import type { DocsPageResponse } from '#shared/docs'

export default defineEventHandler(async (event): Promise<DocsPageResponse> => {
  const q = getQuery(event)
  const lang = docsLang(q.lang)
  const section = q.section === 'developers' ? 'developers' : q.section === 'editors' ? 'editors' : null
  const [page, nav] = section ? await Promise.all([docsPage(lang, section, String(q.slug ?? '')), docsNav(lang)]) : [null, null]
  if (!page || !nav) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setHeader(event, 'cache-control', 'public, max-age=300')
  return { page, nav }
})
