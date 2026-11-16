import { isLinkRef } from '../../src/linkref'

/**
 * What a stored link reference (`cms:<entity>/<id>`) points at, for the admin: the
 * target's title and address in the language being edited, and whether visitors can
 * follow it (`live`), it waits for the entry to be published (`draft`), the entry is
 * gone or not readable by this person (`missing`: the two are not told apart).
 *
 * Asked for in batches (one request per tick, whatever number of links are on the
 * screen) and kept per language for the visit; picking a page puts it here directly.
 */
export interface CmsLinkTarget {
  entity: string
  id: string
  title: string
  path: string | null
  state: 'live' | 'draft' | 'missing'
}

const cacheKey = (locale: string | null, ref: string) => `${locale ?? ''}|${ref}`

// One queue for the page: refs wanted this tick, sent together.
let queue = new Map<string, Set<string>>()
let timer: ReturnType<typeof setTimeout> | undefined

export function useCmsLinkTargets() {
  const route = useRoute()
  const targets = useState<Record<string, CmsLinkTarget>>('cms-link-targets', () => ({}))
  /** The content language being edited (null: single-language content). */
  const locale = computed(() => (typeof route.query.locale === 'string' ? route.query.locale : null))

  function flush() {
    timer = undefined
    const batches = queue
    queue = new Map()
    for (const [loc, refs] of batches) {
      const wanted = [...refs]
      cmsFetch<{ items: Record<string, CmsLinkTarget> }>('/api/cms/_links/resolve', { method: 'POST', body: { refs: wanted, locale: loc || null } })
        .then((res) => {
          const next = { ...targets.value }
          // A ref the server did not answer for stays unknown (shown without details).
          for (const r of wanted) if (res.items[r]) next[cacheKey(loc || null, r)] = res.items[r]!
          targets.value = next
        })
        .catch(() => { /* the link still works; its details just are not shown */ })
    }
  }

  /** Ask for these references (in the language being edited) unless already known or on the way. */
  function request(refs: string[], forLocale: string | null = locale.value) {
    if (!import.meta.client) return
    const known = targets.value
    const loc = forLocale ?? ''
    const set = queue.get(loc) ?? new Set<string>()
    for (const r of refs) if (isLinkRef(r) && !known[cacheKey(forLocale, r)]) set.add(r)
    if (!set.size) return
    queue.set(loc, set)
    timer ??= setTimeout(flush, 0)
  }

  /** Remember what is known already (the picker has just shown it). */
  function seed(ref: string, target: CmsLinkTarget, forLocale: string | null = locale.value) {
    targets.value = { ...targets.value, [cacheKey(forLocale, ref)]: target }
  }

  /** Forget what is known (a changed page may read differently now). */
  function forget() {
    targets.value = {}
  }

  const find = (ref: string | null | undefined, forLocale: string | null = locale.value) =>
    (ref ? targets.value[cacheKey(forLocale, ref)] ?? null : null)

  return { locale, request, seed, forget, find, targets }
}

/** The target of one stored link value, reactive: null while unknown or when the value is not a reference. */
export function useCmsLinkTarget(value: () => string | null | undefined) {
  const { locale, request, find } = useCmsLinkTargets()
  watch(() => [value(), locale.value] as const, ([v, loc]) => {
    if (v && isLinkRef(v)) request([v], loc)
  }, { immediate: true })
  return computed(() => find(value(), locale.value))
}
