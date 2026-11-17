// The website search, ready to use: published entries of every public collection
// with an address, in the page's language, best first, each with its address and a
// snippet around the words found (GET /api/content/_search).
//
//   const route = useRoute()
//   const { items, total, pending } = await useCmsSearch(() => String(route.query.q ?? ''), { locale: lang })
//   <NuxtLink v-for="r in items" :to="r.path"><CmsHighlight :text="r.title" :ranges="r.titleHighlights" /></NuxtLink>
//
// Rendered on the server for the first query (a search page works without JavaScript
// and can be linked to); asks again whenever the query or the language changes.

import type { CmsSearchItem, CmsSearchResult } from '../../src/frontend'

export type { CmsSearchItem, CmsSearchResult }

export async function useCmsSearch(
  query: MaybeRefOrGetter<string>,
  opts: {
    locale?: MaybeRefOrGetter<string | null | undefined>
    /** Most results (1–50, default 10). */
    limit?: number
    /** Only these collections, e.g. ['page', 'news']. */
    entities?: string[]
  } = {},
) {
  const q = computed(() => String(toValue(query) ?? '').trim())
  const locale = computed(() => toValue(opts.locale) || undefined)
  const params = computed(() => ({
    q: q.value,
    ...(locale.value ? { locale: locale.value } : {}),
    ...(opts.limit ? { limit: opts.limit } : {}),
    ...(opts.entities?.length ? { entity: opts.entities.join(',') } : {}),
  }))
  // Asks again whenever the query or the language changes (a query under two letters
  // is answered at once with nothing, without touching the database).
  const { data, pending, error } = await useFetch<CmsSearchResult>('/api/content/_search', {
    query: params,
    key: computed(() => `cms-search:${JSON.stringify(params.value)}`),
    default: () => ({ query: '', items: [], total: 0 }),
  })
  return {
    items: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    /** The query the shown results are for. */
    searched: computed(() => data.value?.query ?? ''),
    pending,
    error,
  }
}
