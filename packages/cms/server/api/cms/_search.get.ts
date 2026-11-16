import { SEARCH_MAX_QUERY, searchTerms } from 'tinyzoo'

// GET /api/cms/_search?q=… — the admin's search (⌘K): entries of every collection the
// signed-in person may read, drafts included, matched in any language. A few best
// matches per collection, best first:
//   { query, items: [{ entity, id, title, titleHighlights, excerpt, highlights, status, updatedAt }] }
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().slice(0, SEARCH_MAX_QUERY)
  const perEntity = Math.min(20, Math.max(1, Number(query.limit) || 5))
  const terms = searchTerms(q)
  if (!terms.length) return { query: q, items: [] }
  const found = await searchAdmin(db, reg, user, terms, q, perEntity)
  return { query: q, items: found.map(({ score: _score, ...item }) => item) }
})
