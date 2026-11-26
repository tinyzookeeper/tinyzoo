import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import { cmsBuilderPathOf, cmsBuilderPlaceAnchor, type CmsBuilderListKinds, type CmsBuilderPath, type CmsBuilderPlace, type CmsBuilderToAdmin, type CmsBuilderToPage } from '../../shared/builder'
import { kindsAlong, pathOfListKey, type BlockKindDef, type BlockList } from '../../shared/block-tree'

// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), admin side: a bridge between the
// page-blocks fields of the form and the preview panel that shows the page. The fields register
// themselves (their value, their block types, and the changes they make with the shared tree
// functions of shared/block-tree.ts: ids, checks and limits stay in one place); the panel registers
// as the sender to the page inside it and passes the page's messages on. With the switch off nothing
// is provided, so `useCmsBuilder()` is `null` and nothing of this is registered, listened to or drawn.
//
// A block is named by its path of ids from the page's list down (shared/builder.ts). A list inside a
// block's row in the form may not be mounted (its row is closed), so the bridge never asks one: the
// page-blocks field changes its whole value as a tree, and a list inside follows `openPath` when it
// mounts or when it changes.

/** What a page-blocks field lets the bridge do. The changes do nothing on a field that is read-only. */
export interface CmsBuilderList {
  /** The field's key (`sections`): a list inside it has a key that starts with it. */
  key: string
  /** Its value as a tree: the blocks, their types and the limit. */
  root: () => BlockList
  ids: () => string[]
  /** The names of its block types, by type. */
  labels: () => Record<string, string>
  /** What the list takes, all the way down, for the page. */
  kinds: () => CmsBuilderListKinds
  /** Open the rows along this path (closing the others at each level) and bring the last into view. */
  reveal: (path: CmsBuilderPath) => void
  /** Close every row of the list. */
  collapse: () => void
  move: (path: CmsBuilderPath, place: CmsBuilderPlace) => void
  duplicate: (path: CmsBuilderPath) => void
  remove: (path: CmsBuilderPath) => void
  /** Ask which block to add (the picker of that list's types), then add it there. */
  add: (place: CmsBuilderPlace) => void
}

/** The mounted preview panel. */
export interface CmsBuilderPanel {
  send: (message: CmsBuilderToPage) => void
  /** Post the draft now, without the typing delay. */
  postNow: () => void
}

/** The selected block and what it is, from the page's list down. */
export interface CmsBuilderSelection {
  path: CmsBuilderPath
  /** Each block along the path: its id, type, name and definition (the last one is the selected block). */
  along: { id: string; type: string; label: string; def: BlockKindDef | undefined }[]
}

export interface CmsBuilder {
  lists: Readonly<Ref<readonly CmsBuilderList[]>>
  /** The block the editor and the page both have selected (the last id of `selectedPath`). */
  selected: Ref<string | null>
  /** Its path from the page's list down. */
  selectedPath: Ref<CmsBuilderPath | null>
  /** The selected block with the definitions along its path (for a panel that shows it alone). */
  selection: ComputedRef<CmsBuilderSelection | null>
  /** The rows the form should open, asked for by the page; a list inside a row follows it when it mounts. */
  openPath: Readonly<ShallowRef<{ path: CmsBuilderPath; at: number } | null>>
  /** The block types' names of every registered list, by type. */
  labels: ComputedRef<Record<string, string>>
  /** What the page's list takes, all the way down. */
  kinds: ComputedRef<CmsBuilderListKinds>
  register: (list: CmsBuilderList) => () => void
  attach: (panel: CmsBuilderPanel) => () => void
  /** A row was opened in the form (by the person, an insert or a duplicate): the page selects that block and scrolls to it. */
  opened: (path: CmsBuilderPath | string) => void
  /** Ask the form to open the rows along a path. */
  open: (path: CmsBuilderPath) => void
  /** The page asked for something. */
  fromPage: (message: CmsBuilderToAdmin) => void
  /** Something changed that the page should show now: the panel posts the draft at once. */
  changed: () => void
  /** The path of the block whose list a list of the form is, from its field key (`sections.2.items`); `null` outside the page's blocks. */
  pathOf: (key: string) => CmsBuilderPath | null
}

const KEY: InjectionKey<ShallowRef<CmsBuilder | null>> = Symbol('cmsBuilder')
const NONE: ShallowRef<CmsBuilder | null> = shallowRef(null)
function createBridge(): CmsBuilder {
  const lists = shallowRef<CmsBuilderList[]>([])
  const selectedPath = shallowRef<CmsBuilderPath | null>(null)
  const selected = computed<string | null>({
    get: () => selectedPath.value?.[selectedPath.value.length - 1] ?? null,
    set: (id) => { selectedPath.value = id === null ? null : [id] },
  })
  const openPath = shallowRef<{ path: CmsBuilderPath; at: number } | null>(null)
  let panel: CmsBuilderPanel | null = null
  const owner = (id: string | undefined) => (id === undefined ? lists.value[0] : lists.value.find((l) => l.ids().includes(id)))
  const labels = computed(() => Object.assign({}, ...lists.value.map((l) => l.labels())) as Record<string, string>)
  const kinds = computed<CmsBuilderListKinds>(() => {
    const all = lists.value.map((l) => l.kinds())
    return all.length === 1 ? all[0]! : { types: Object.assign({}, ...all.map((k) => k.types)), max: null }
  })
  const selection = computed<CmsBuilderSelection | null>(() => {
    const path = selectedPath.value
    const list = path ? owner(path[0]) : undefined
    if (!path || !list) return null
    const names = labels.value
    return { path, along: kindsAlong(list.root(), path).map((k) => ({ ...k, label: names[k.type] ?? k.type })) }
  })
  function changed() {
    void nextTick(() => panel?.postNow())
  }
  return {
    lists, selected, selectedPath, selection, openPath, labels, kinds,
    register(list) {
      lists.value = [...lists.value, list]
      return () => { lists.value = lists.value.filter((l) => l !== list) }
    },
    attach(next) {
      panel = next
      return () => { if (panel === next) panel = null }
    },
    opened(target) {
      const path = typeof target === 'string' ? [target] : target
      if (selectedPath.value?.join('/') === path.join('/')) return
      selectedPath.value = path
      panel?.send({ type: 'cms:builder:select', id: path[path.length - 1]!, path, scroll: true })
    },
    open(path) {
      openPath.value = { path, at: Date.now() }
    },
    fromPage(message) {
      if (message.type === 'cms:builder:ready') return
      if (message.type === 'cms:builder:select') {
        // The page has this block selected already: no message back.
        const path = message.id === null ? null : cmsBuilderPathOf({ id: message.id, path: message.path })
        selectedPath.value = path
        if (path) owner(path[0])?.reveal(path)
        return
      }
      if (message.type === 'cms:builder:add') {
        const first = message.place.in?.[0] ?? cmsBuilderPlaceAnchor(message.place) ?? undefined
        owner(first)?.add(message.place)
        return
      }
      const path = cmsBuilderPathOf(message)
      const list = owner(path[0])
      if (!list) return
      if (message.type === 'cms:builder:move') list.move(path, message.place)
      else if (message.type === 'cms:builder:duplicate') list.duplicate(path)
      else list.remove(path)
      changed()
    },
    changed,
    pathOf(key) {
      for (const l of lists.value) {
        const path = pathOfListKey(l.key, l.root().items, key)
        if (path) return path
      }
      return null
    },
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
