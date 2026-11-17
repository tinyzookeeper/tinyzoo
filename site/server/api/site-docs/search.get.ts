// Search the documentation: GET /api/site-docs/search?q=role&lang=cs&limit=8. The same
// matching as the website search (words in any order, accents and small typos forgiven,
// see tinyzoo's src/search.ts), over each heading's text; one page gives at most two hits.
import { SEARCH_MAX_QUERY, highlightRanges, matchEntry, searchTerms } from 'tinyzoo'
import type { DocsSearchHit } from '#shared/docs'

export default defineEventHandler(async (event): Promise<{ query: string; items: DocsSearchHit[]; total: number }> => {
  const q = getQuery(event)
  const query = String(q.q ?? '').trim().slice(0, SEARCH_MAX_QUERY)
  const limit = Math.min(Math.max(Number(q.limit) || 10, 1), 50)
  const terms = searchTerms(query)
  if (query.length < 2 || !terms.length) return { query, items: [], total: 0 }
  const index = (await docsSearchIndex(docsLang(q.lang))) ?? []
  const found: (DocsSearchHit & { score: number })[] = []
  for (const s of index) {
    const title = s.heading || s.page
    const match = matchEntry(title, [s.text, s.heading ? s.page : ''], terms, query)
    if (!match) continue
    // The page itself (its title, its first lines) ranks a little above one of its headings.
    found.push({
      entity: 'docs', id: `${s.path}#${s.anchor}`, title, titleHighlights: highlightRanges(title, terms),
      excerpt: match.excerpt, highlights: match.highlights, path: s.anchor ? `${s.path}#${s.anchor}` : s.path,
      page: s.heading ? s.page : '', section: s.section, score: match.score + (s.anchor ? 0 : 5),
    })
  }
  found.sort((a, b) => b.score - a.score)
  const perPage = new Map<string, number>()
  const items: DocsSearchHit[] = []
  for (const { score: _, ...hit } of found) {
    const page = hit.path.split('#')[0]!
    const n = perPage.get(page) ?? 0
    if (n >= 2) continue
    perPage.set(page, n + 1)
    items.push(hit)
  }
  setHeader(event, 'cache-control', 'public, max-age=60')
  return { query, items: items.slice(0, limit), total: items.length }
})
