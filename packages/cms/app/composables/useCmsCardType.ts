import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import { cardEntryTitle, cardExampleRow, type CardType } from '../../shared/builder-card'
import { cmsCardTypeOf, type CmsCardTypeMeta } from '../utils/cmsCardType'

// The content type a card shows, and its entries, for the panel of a card's block (the editor in the
// preview, NUXT_CMS_BUILDER=on): the type from the admin graph, a few entries from the admin's list API
// for examples ("Ukázky jsou z karty …"), and the count of entries (the block picker names it). One cache
// per type name at module level, so many components share one request: a call asks again at most once
// every few seconds, and `refresh()` asks at once. A failed request leaves no entries and no count; nothing
// here throws. The entries are only fetched in the browser, after mount.

const PAGE = 50
const FRESH_MS = 5000

interface Store { rows: Ref<Record<string, any>[]>; total: Ref<number | null>; loading: Ref<boolean>; at: number; running: Promise<void> | null; counting: Promise<void> | null }
const stores = new Map<string, Store>()
function storeOf(name: string): Store {
  let s = stores.get(name)
  if (!s) {
    s = { rows: shallowRef<Record<string, any>[]>([]), total: ref<number | null>(null), loading: ref(false), at: 0, running: null, counting: null }
    stores.set(name, s)
  }
  return s
}

/** The first entries of a type and how many there are: one request at a time per type; empty and unknown on an error. */
function load(name: string): Promise<void> {
  const s = storeOf(name)
  if (s.running) return s.running
  s.loading.value = true
  s.running = cmsFetch<{ rows?: Record<string, any>[]; total?: number }>(`/api/cms/${name}`, { query: { limit: PAGE } })
    .then((res) => {
      s.rows.value = Array.isArray(res?.rows) ? res.rows : []
      s.total.value = typeof res?.total === 'number' ? res.total : null
    })
    .catch(() => {
      s.rows.value = []
      s.total.value = null
    })
    .finally(() => {
      s.at = Date.now()
      s.loading.value = false
      s.running = null
    })
  return s.running
}

/** Only the count (one entry asked for): for a list of many types that does not need their entries. */
function count(name: string): Promise<void> {
  const s = storeOf(name)
  if (s.running) return s.running
  if (s.counting) return s.counting
  s.counting = cmsFetch<{ total?: number }>(`/api/cms/${name}`, { query: { limit: 1 } })
    .then((res) => { if (typeof res?.total === 'number') s.total.value = res.total })
    .catch(() => { s.total.value = null })
    .finally(() => { s.counting = null })
  return s.counting
}

const fresh = (s: Store) => s.at > 0 && Date.now() - s.at < FRESH_MS

/**
 * The type (from the graph), its names and page address, the first entries and the count of a content
 * type of the site's own. `typeName` may be missing or not a type of the site: everything is then empty.
 */
export function useCmsCardType(typeName: MaybeRefOrGetter<string | null | undefined>): {
  type: ComputedRef<CardType | null>
  meta: ComputedRef<CmsCardTypeMeta | null>
  total: Readonly<Ref<number | null>>
  rows: Readonly<Ref<Record<string, any>[]>>
  loading: Readonly<Ref<boolean>>
  refresh: () => Promise<void>
} {
  const { t, tl } = useCmsI18n()
  const { data: graph } = useNuxtData<any[]>('cms-graph')
  const name = computed(() => toValue(typeName) || null)
  const found = computed(() => cmsCardTypeOf(graph.value, name.value, tl, t('fieldRef.page')))
  const store = computed(() => (name.value ? storeOf(name.value) : null))
  const ask = () => {
    const n = name.value
    if (n && found.value && import.meta.client && !fresh(storeOf(n))) void load(n)
  }
  // (A watcher's callback runs outside the component: whether it is mounted is kept here.)
  let mounted = false
  onMounted(() => { mounted = true; ask() })
  watch([name, () => !!found.value], () => { if (import.meta.client && mounted) ask() })
  return {
    type: computed(() => found.value?.type ?? null),
    meta: computed(() => found.value?.meta ?? null),
    total: computed(() => store.value?.total.value ?? null),
    rows: computed(() => store.value?.rows.value ?? []),
    loading: computed(() => store.value?.loading.value ?? false),
    refresh: () => (name.value && import.meta.client ? load(name.value) : Promise.resolve()),
  }
}

/**
 * How many entries each of these types has (null while unknown, or when the request failed), for the
 * block picker's "Záznamy: 12". Asks once per type after mount (one entry each, unless the type's
 * entries are loaded already); shares what `useCmsCardType` loaded.
 */
export function useCmsCardTotals(names: MaybeRefOrGetter<readonly string[]>): { totals: ComputedRef<Record<string, number | null>>; refresh: () => Promise<void> } {
  const list = computed(() => [...new Set(toValue(names))].filter(Boolean))
  const ask = () => {
    if (!import.meta.client) return
    for (const n of list.value) if (!fresh(storeOf(n))) void count(n)
  }
  let mounted = false
  onMounted(() => { mounted = true; ask() })
  watch(list, () => { if (mounted) ask() })
  return {
    totals: computed(() => Object.fromEntries(list.value.map((n) => [n, storeOf(n).total.value]))),
    refresh: async () => { await Promise.all(list.value.map((n) => load(n))) },
  }
}

/**
 * The entry a card's panel takes its examples from (CardExamplePick): the card the person clicked in the
 * page, else the first entry the page says the section shows, else the first entry. With its title, for the
 * quiet line "Ukázky jsou z karty {title}."
 */
export function useCmsCardExample(
  typeName: MaybeRefOrGetter<string | null | undefined>,
  section: MaybeRefOrGetter<string | null | undefined>,
): { row: ComputedRef<Record<string, any> | null>; title: ComputedRef<string>; card: ReturnType<typeof useCmsCardType> } {
  const card = useCmsCardType(typeName)
  const builder = useCmsBuilder()
  const row = computed(() => {
    const entity = toValue(typeName)
    const at = toValue(section) ?? null
    if (!entity) return null
    return cardExampleRow(card.rows.value, {
      entity, section: at, cardEntry: builder.value?.cardEntry.value ?? null,
      sources: at ? builder.value?.sources.value[at] ?? null : null,
      fields: card.type.value?.fields.map((f) => f.key) ?? null,
    })
  })
  return { row, title: computed(() => cardEntryTitle(row.value, card.type.value?.titleField ?? '')), card }
}
