import type { Ref } from 'vue'
import type { CustomType } from '../utils/customTypes'

// The site's own content types (custom types), from `GET /api/content/_types`: fetched once per
// page and shared, as `useSite` shares the settings. A site without them (the feature off, a
// template's own build) gets an empty list, and so does a request that fails: what draws them
// then draws nothing.
export async function useCustomTypes() {
  const { site } = useDesign()
  const { data } = await useFetch<{ types: CustomType[] }>('/api/content/_types', { key: 'site-custom-types' })
  const types = computed(() => (Array.isArray(data.value?.types) ? data.value.types : []))
  const lang = site.DEFAULT_LANGUAGE
  return {
    types,
    /** The site's language, for labels and values. */
    lang,
    /** A label in the site's language, else in any it has. */
    label: (l: Parameters<typeof customLabel>[0]) => customLabel(l, lang),
    /** A type by its name. */
    type: (name: unknown) => customTypeOf(types.value, name),
    /** A field of a type by its key. */
    field: (type: CustomType | null | undefined, key: unknown) => customFieldOf(type, key),
    /** The value of a field of an entry as text to show ('' when there is none). */
    text: (field: Parameters<typeof customFieldText>[0], value: unknown) => customFieldText(field, value, { lang, types: types.value }),
  }
}

/**
 * A block of the site's own type (`custom_entries`: `kind: 'entries'`, `custom_chosen`: `'chosen'`): its
 * plan (customBlockPlan) and its entries as cards, fetched on the server with a key of the block's
 * own, so the page comes drawn complete. Nothing to draw (no cards) when the block names no type
 * or one the site does not have, when the request fails, or when there are no entries.
 *
 * `custom` is what `await useCustomTypes()` gave the component: Nuxt's composables keep their
 * context across an `await` of a component's setup, not across one inside another composable.
 */
export async function useCustomBlock(block: () => Record<string, any>, kind: 'entries' | 'chosen', custom: Awaited<ReturnType<typeof useCustomTypes>>) {
  const route = useRoute()
  const fetcher = useRequestFetch()
  const plan = computed(() => customBlockPlan(block(), custom.types.value, kind))
  // A draft is previewed with ?preview: chosen entries then show as the editor sees them.
  const query = 'preview' in route.query ? { preview: '' } : {}
  const warn = (why: string) => { if (import.meta.dev) console.warn(`[${block()?.type ?? kind}] block ${block()?.id ?? ''} draws nothing: ${why}`) }
  const { data } = await useAsyncData(
    () => `custom-block:${block()?.id ?? ''}:${plan.value.ok ? JSON.stringify(plan.value.request) : ''}`,
    async () => {
      const p = plan.value
      if (!p.ok) return []
      const get = fetcher as (url: string, opts: { query: Record<string, unknown> }) => Promise<any>
      try {
        if (p.request.kind === 'list') {
          const res = await get(p.request.path, { query: { ...p.request.query, ...query } })
          return Array.isArray(res?.items) ? res.items : []
        }
        // Each chosen entry on its own, together; one that is gone (404) is left out.
        return customChosenEntries(await Promise.all(p.request.paths.map((path) => get(path, { query }).catch(() => null))))
      }
      catch (err: any) {
        warn(`the content API answered ${err?.statusCode ?? err?.message ?? err}`)
        return []
      }
    },
  )
  const cards = computed(() => (plan.value.ok ? customCards(data.value ?? [], plan.value, { lang: custom.lang, types: custom.types.value }) : []))
  if (!plan.value.ok) warn(plan.value.reason)
  else if (!cards.value.length) warn('no entries')
  return { plan, cards }
}

/**
 * The cards of a list with a card of its own (`section_list`): its plan (cardListPlan) and one card
 * per entry (cardEntries), the entries fetched on the server with a key of the block's own, so the
 * page comes drawn complete. No cards when the block names no type or one the site does not have, or
 * when the request fails; while `editing` the readers give a sample card (no entries) or an empty card.
 *
 * `custom` is what `await useCustomTypes()` gave the component, and `editing` is useCmsEditing():
 * Nuxt's composables keep their context across an `await` of a component's setup, not across one
 * inside another composable.
 */
export async function useCustomCard(block: () => Record<string, any>, custom: Awaited<ReturnType<typeof useCustomTypes>>, editing: Ref<boolean>) {
  const route = useRoute()
  const fetcher = useRequestFetch()
  const plan = computed(() => cardListPlan(block(), custom.types.value, custom.lang))
  // A draft is previewed with ?preview, as for useCustomBlock.
  const query = 'preview' in route.query ? { preview: '' } : {}
  const warn = (why: string) => { if (import.meta.dev) console.warn(`[${block()?.type ?? 'section_list'}] block ${block()?.id ?? ''} draws nothing: ${why}`) }
  const { data } = await useAsyncData(
    () => `custom-card:${block()?.id ?? ''}:${plan.value.ok ? JSON.stringify(plan.value.request) : ''}`,
    async () => {
      const p = plan.value
      if (!p.ok) return []
      const get = fetcher as (url: string, opts: { query: Record<string, unknown> }) => Promise<any>
      try {
        const res = await get(p.request.path, { query: { ...p.request.query, ...query } })
        return Array.isArray(res?.items) ? res.items : []
      }
      catch (err: any) {
        warn(`the content API answered ${err?.statusCode ?? err?.message ?? err}`)
        return []
      }
    },
  )
  const cards = computed(() => {
    const p = plan.value
    return p.ok ? cardEntries(p, data.value ?? [], { lang: custom.lang, editing: editing.value }) : []
  })
  if (!plan.value.ok) warn(plan.value.reason)
  return { plan, cards }
}
