import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type { CmsBuilderPlace, CmsBuilderToAdmin, CmsBuilderToPage } from '../../shared/builder'

// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), admin side: a bridge between the
// page-blocks fields of the form and the preview panel that shows the page. The fields register
// themselves (their block ids, their type labels, and the changes they already know how to make:
// validation, ids and limits stay in the field); the panel registers as the sender to the page
// inside it and passes the page's messages on. With the switch off nothing is provided, so
// `useCmsBuilder()` is `null` and nothing of this is registered, listened to or drawn.

/** What a page-blocks field lets the bridge do. The changes do nothing on a field that is read-only. */
export interface CmsBuilderList {
  ids: () => string[]
  /** The names of its block types, by type. */
  labels: () => Record<string, string>
  /** Open this block's row (closing the others) and bring it into view. */
  reveal: (id: string) => void
  /** Close every row of the list. */
  collapse: () => void
  move: (id: string, place: CmsBuilderPlace) => void
  duplicate: (id: string) => void
  remove: (id: string) => void
  add: (place: CmsBuilderPlace) => void
}

/** The mounted preview panel. */
export interface CmsBuilderPanel {
  send: (message: CmsBuilderToPage) => void
  /** Post the draft now, without the typing delay. */
  postNow: () => void
}

export interface CmsBuilder {
  lists: Readonly<Ref<readonly CmsBuilderList[]>>
  /** The block the editor and the page both have selected. */
  selected: Ref<string | null>
  /** The block types' names of every registered list, by type. */
  labels: ComputedRef<Record<string, string>>
  register: (list: CmsBuilderList) => () => void
  attach: (panel: CmsBuilderPanel) => () => void
  /** A row was opened in the form (by the person, an insert or a duplicate): the page selects that block and scrolls to it. */
  opened: (id: string) => void
  /** The page asked for something. */
  fromPage: (message: CmsBuilderToAdmin) => void
  /** Something changed that the page should show now: the panel posts the draft at once. */
  changed: () => void
}

const KEY: InjectionKey<ShallowRef<CmsBuilder | null>> = Symbol('cmsBuilder')
const NONE: ShallowRef<CmsBuilder | null> = shallowRef(null)
function createBridge(): CmsBuilder {
  const lists = shallowRef<CmsBuilderList[]>([])
  const selected = ref<string | null>(null)
  let panel: CmsBuilderPanel | null = null
  const owner = (id: string) => lists.value.find((l) => l.ids().includes(id))
  const labels = computed(() => Object.assign({}, ...lists.value.map((l) => l.labels())) as Record<string, string>)
  function changed() {
    void nextTick(() => panel?.postNow())
  }
  return {
    lists, selected, labels,
    register(list) {
      lists.value = [...lists.value, list]
      return () => { lists.value = lists.value.filter((l) => l !== list) }
    },
    attach(next) {
      panel = next
      return () => { if (panel === next) panel = null }
    },
    opened(id) {
      if (selected.value === id) return
      selected.value = id
      panel?.send({ type: 'cms:builder:select', id, scroll: true })
    },
    fromPage(message) {
      if (message.type === 'cms:builder:ready') return
      if (message.type === 'cms:builder:select') {
        // The page has this block selected already: no message back.
        selected.value = message.id
        if (message.id !== null) owner(message.id)?.reveal(message.id)
        return
      }
      if (message.type === 'cms:builder:add') {
        const anchor = 'before' in message.place ? message.place.before : message.place.after
        owner(anchor)?.add(message.place)
        return
      }
      const list = owner(message.id)
      if (!list) return
      if (message.type === 'cms:builder:move') list.move(message.id, message.place)
      else if (message.type === 'cms:builder:duplicate') list.duplicate(message.id)
      else list.remove(message.id)
      changed()
    },
    changed,
  }
}

/**
 * Provide the bridge as a ref: `null` until `on` is true, then the bridge, created once (it never goes
 * back to `null`). The switch comes with the menu, which may arrive after the editor's setup.
 */
export function provideCmsBuilder(on: Ref<boolean>): ShallowRef<CmsBuilder | null> {
  const bridge = shallowRef<CmsBuilder | null>(null)
  watch(on, (value) => { if (value && !bridge.value) bridge.value = createBridge() }, { immediate: true })
  provide(KEY, bridge)
  return bridge
}

/** The editor's bridge as a ref (`null` inside: the switch is off, or not known yet; outside an editor, a ref that stays `null`). */
export function useCmsBuilder(): ShallowRef<CmsBuilder | null> {
  return inject(KEY, NONE)
}

/**
 * Whether the editor in the preview is on for this site: the admin's menu says so (`builder`, only
 * when the server has NUXT_CMS_BUILDER=on). Reads the layout's own request; asks nothing itself.
 */
export function useCmsBuilderOn(): ComputedRef<boolean> {
  const { data } = useNuxtData<{ builder?: true }>('cms-menu')
  return computed(() => data.value?.builder === true)
}
