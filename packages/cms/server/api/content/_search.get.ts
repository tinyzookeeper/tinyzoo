import { SEARCH_MAX_QUERY, searchTerms } from 'tinyzoo'

// GET /api/content/_search?q=…&locale=en&limit=10&entity=page,news — the website search.
// Published entries of every public collection with an address (`content.path`),
// in the visitor's language, best matches first, each with its address and a snippet:
//   { query, items: [{ entity, id, title, titleHighlights, excerpt, highlights, path, locale, updatedAt }], total }
// Highlights are [start, end) character ranges in the title and the excerpt.
export default defineEventHandler(async (event) => {
  assertContentAuth(event)
  const { db, reg } = useCms()
  const locale = requestedLocale(event, reg)
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().slice(0, SEARCH_MAX_QUERY)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10))
  const only = query.entity ? new Set(String(query.entity).split(',').map((s) => s.trim()).filter(Boolean)) : undefined
  setContentCache(event)

  const terms = searchTerms(q)
  // One letter finds everything: wait for a second one.
  if (!terms.length || q.length < 2) return { query: q, items: [], total: 0 }

  // Every search reads several collections: keep one visitor from hammering it.
  if (!(await rateLimit(`search:${clientIp(event)}`, 120, 60_000))) {
    throw tooManyRequests(event, 'Too many searches; try again in a minute', 60_000)
  }
  const found = await searchPublic(db, reg, terms, q, locale, only)
  return { query: q, items: found.slice(0, limit).map(({ score: _score, ...item }) => item), total: found.length }
})
