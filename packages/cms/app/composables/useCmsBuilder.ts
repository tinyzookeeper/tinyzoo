import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import { cmsBuilderPathOf, cmsBuilderPlaceAnchor, type CmsBuilderListKinds, type CmsBuilderPath, type CmsBuilderPlace, type CmsBuilderToAdmin, type CmsBuilderToPage } from '../../shared/builder'
import { changedBlock, findBlock, kindsAlong, pathOfId, pathOfListKey, textEdit, type BlockKindDef, type BlockList } from '../../shared/block-tree'
import { createBuilderHistory } from '../../shared/builder-history'
import { isEntryStep, type CmsBuilderStep } from '../../shared/builder-pending'
import { cmsBuilderEntryAddress, type CmsBuilderEntity, type CmsBuilderSource } from '../../shared/builder-sources'
import type { CmsBuilderRect } from '../../shared/builder'
import { createCmsPending, type CmsBuilderPendingStore } from './useCmsBuilderPending'

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
//
// The bridge also keeps the history of the page-blocks field's changes while the editor is open (undo and
// redo, shared/builder-history.ts): the field records each change it makes, the bridge applies an undo
// through the field and selects what changed, in the page and in the form.
//
// A plain text typed in the page (since 2d) is set through the field like any typing in the form, so it
// is one step of the history per field per pause too. A click in the page on a field that is not typed
// there (a rich text, a picture) asks the panel to bring that field into view (`fieldRequest`).
//
// Since 2f the page says where the selected block's content comes from besides its own fields (`sources`:
// the collections and globals it shows, with the entries it shows now), and asks to edit an entry beside the
// page (`entryRequest`, which the editor's sheet opens) or to open it in its own section. An entry is saved
// on its own: the page's history never holds it.
//
// Since 2g the values of an entry or a global are changed in the page too: a plain text typed there, a
// value in a box the admin draws over the preview (`box`, with the element's place as the page says it).
// These changes wait in the editor (`pending`, useCmsBuilderPending) with the page's own: the history holds
// them as steps in the order they were made, and the editor's save stores them with the page.

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
  /** Set a field of the block at `path` (the focus panel's fields). */
  set: (path: CmsBuilderPath, key: string, value: unknown) => void
  /** Put a whole value back (an undo or a redo): no step of the history. */
  apply: (items: any[]) => void
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
  /** Select a block (or none) in the form and in the page, which scrolls to it. */
  select: (path: CmsBuilderPath | null) => void
  /** Whether the form shows the selected block alone (the focus panel): the editor sets it while the preview is beside the form. */
  panel: Ref<boolean>
  /** The form shows the selected block alone now: the panel is on and the selected block is in the form's value. */
  focused: ComputedRef<boolean>
  /** Since 2d: a field the page asked to bring into view in the panel (`open`: and open its chooser). */
  fieldRequest: Readonly<ShallowRef<{ path: CmsBuilderPath; field: string; item: string | null; open: boolean; at: number } | null>>
  /** Since 2d: the panel takes the keyboard focus when it opens next (a row opened with the keyboard, not a click in the page). */
  focusPanel: Ref<boolean>
  /** Since 2f: where each block's content comes from besides its own fields, as the page last said it (by the block's path). */
  sources: Readonly<ShallowRef<Record<string, CmsBuilderSource[]>>>
  /** Since 2f: the collections and globals as the page was told of them (the preview panel sets them). */
  entities: ShallowRef<Record<string, CmsBuilderEntity>>
  /** Since 2f: an entry (or a global) to edit beside the page; `id: null` a new entry; `field` to bring into view. */
  entryRequest: Readonly<ShallowRef<{ entity: string; id: string | null; field: string | null; at: number } | null>>
  /** Since 2f: edit an entry beside the page (`id: null`: add one). */
  editEntry: (entity: string, id: string | null, field?: string | null) => void
  /** Since 2f: the sheet closed (or opened another entry). */
  closeEntry: () => void
  /** Since 2f: the page shows its content anew (an entry beside it was typed in or saved). */
  refresh: () => void
  /** Since 2g: the changes to entries and globals made in the page, waiting for the editor's save. */
  pending: CmsBuilderPendingStore
  /** Since 2g: the values the page asked a box for (their own controls, drawn over the preview at `rect`, the page's pixels). */
  box: Readonly<ShallowRef<{ entity: string; id: string; values: string[][]; rect: CmsBuilderRect; at: number } | null>>
  /** Since 2g: close the box (the page is told). */
  closeBox: () => void
  /** The history of the page-blocks field's changes while the editor is open. */
  history: {
    canUndo: Readonly<Ref<boolean>>
    canRedo: Readonly<Ref<boolean>>
    /** Keep a change of a page-blocks field (its whole value before and after; `group`: the field typed in, see typingGroup). Returns the step. */
    record: (key: string, before: any[], after: any[], group?: string | null) => number
    undo: () => void
    redo: () => void
    /** Undo only if `step` is still the last one (a toast's *Undo*). */
    undoStep: (step: number) => void
    /** The step an undo takes back now. */
    top: () => number | null
    /** The field's value was replaced from elsewhere (a newer version, a restored one): the steps no longer fit. */
    clear: () => void
  }
}

/** What the bridge reads of the editor around it (taken in the editor's setup: the bridge may be made later). */
export interface CmsBuilderDeps {
  graph: Ref<any[] | null | undefined>
  /** The language the preview shows, when it is a translation. */
  locale: Ref<string | null>
  t: (key: string, params?: Record<string, unknown>) => string
  fieldLabel: (field: any) => string
  entityLabel: (meta: any) => string
  notify: (title: string, description?: string) => void
}

const KEY: InjectionKey<ShallowRef<CmsBuilder | null>> = Symbol('cmsBuilder')
const NONE: ShallowRef<CmsBuilder | null> = shallowRef(null)
function createBridge(deps: CmsBuilderDeps): CmsBuilder {
  const lists = shallowRef<CmsBuilderList[]>([])
  const selectedPath = shallowRef<CmsBuilderPath | null>(null)
  const selected = computed<string | null>({
    get: () => selectedPath.value?.[selectedPath.value.length - 1] ?? null,
    set: (id) => { selectedPath.value = id === null ? null : [id] },
  })
  const openPath = shallowRef<{ path: CmsBuilderPath; at: number } | null>(null)
  const fieldRequest = shallowRef<{ path: CmsBuilderPath; field: string; item: string | null; open: boolean; at: number } | null>(null)
  const focusPanel = ref(false)
  const sources = shallowRef<Record<string, CmsBuilderSource[]>>({})
  const entities = shallowRef<Record<string, CmsBuilderEntity>>({})
  const entryRequest = shallowRef<{ entity: string; id: string | null; field: string | null; at: number } | null>(null)
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
  function select(path: CmsBuilderPath | null) {
    selectedPath.value = path
    if (path) owner(path[0])?.reveal(path)
    panel?.send(path ? { type: 'cms:builder:select', id: path[path.length - 1]!, path, scroll: true } : { type: 'cms:builder:select', id: null, scroll: false })
  }

  // ── the history (one per editor; the steps name the field they belong to) ──
  const steps = createBuilderHistory<CmsBuilderStep>()
  // Plain copies: the form's values are reactive and may be changed in place by a field.
  const copy = (v: unknown): any[] => JSON.parse(JSON.stringify(v ?? []))
  const canUndo = ref(false)
  const canRedo = ref(false)
  const sync = () => {
    canUndo.value = steps.canUndo
    canRedo.value = steps.canRedo
  }
  /** Put a value back and select the block it changed (else the nearest block around it that is there). */
  function restore(key: string, value: any[], other: any[]) {
    const list = lists.value.find((l) => l.key === key)
    if (!list) return
    const defs = list.root().defs
    const what = changedBlock(defs, other, value)
    list.apply(copy(value))
    changed()
    if (!what) return
    const tree: BlockList = { items: value, defs, max: list.root().max }
    let path = pathOfId(tree, what.id)
    for (let n = what.around.length; !path && n > 0; n--) path = pathOfId(tree, what.around[n - 1]!)
    // The value comes back through the form's v-model on the next tick: select once it is there.
    void nextTick(() => select(path))
  }
  /** Take a step back (`to`: its value before) or do it again (its value after): a page-blocks field, or a field of an entry. */
  function apply(to: CmsBuilderStep, from: CmsBuilderStep) {
    if (isEntryStep(to)) pending.put(to.entry.entity, to.entry.id, to.field, to.value)
    else if (!isEntryStep(from)) restore(to.key, to.value as any[], from.value as any[])
  }
  const history: CmsBuilder['history'] = {
    canUndo, canRedo,
    record(key, before, after, group) {
      const step = steps.record({ key, value: copy(before) }, { key, value: copy(after) }, { group: group ? `${key}:${group}` : null })
      sync()
      return step
    },
    undo() {
      const step = steps.undo()
      sync()
      if (step) apply(step.before, step.after)
    },
    redo() {
      const step = steps.redo()
      sync()
      if (step) apply(step.after, step.before)
    },
    undoStep(step) {
      if (steps.top() === step) history.undo()
    },
    top: () => steps.top(),
    clear() {
      steps.clear()
      sync()
    },
  }
  // ── entries and globals changed in the page (since 2g) ──
  const pending = createCmsPending({
    graph: deps.graph, locale: deps.locale, t: deps.t, fieldLabel: deps.fieldLabel, entityLabel: deps.entityLabel, notify: deps.notify,
    send: (message) => panel?.send(message),
    record(entity, id, field, before, after, group) {
      steps.record({ entry: { entity, id }, field, value: before }, { entry: { entity, id }, field, value: after }, { group: `entry:${entity}:${id}:${group ?? field}` })
      sync()
    },
    forget(entity, id) {
      steps.drop((s) => isEntryStep(s.before) && s.before.entry.entity === entity && s.before.entry.id === id)
      sync()
    },
  })
  const box = shallowRef<{ entity: string; id: string; values: string[][]; rect: CmsBuilderRect; at: number } | null>(null)
  function closeBox() {
    if (!box.value) return
    box.value = null
    panel?.send({ type: 'cms:builder:box', open: false })
  }
  const panelOn = ref(false)
  const focused = computed(() => panelOn.value && !!selection.value && selection.value.along.length === selection.value.path.length)
  function editEntry(entity: string, id: string | null, field?: string | null) {
    entryRequest.value = { entity, id, field: field ?? null, at: Date.now() }
  }
  return {
    lists, selected, selectedPath, selection, openPath, labels, kinds, select, history, fieldRequest, focusPanel,
    panel: panelOn, focused, sources, entities, entryRequest, editEntry, pending, box, closeBox,
    closeEntry() { entryRequest.value = null },
    refresh() { panel?.postNow() },
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
      if (message.type === 'cms:builder:history') {
        history[message.action]()
        return
      }
      if (message.type === 'cms:builder:text') {
        const path = cmsBuilderPathOf(message)
        const list = owner(path[0])
        if (!list) return
        const edit = textEdit(list.root(), path, message.field, message.item ?? null, message.value)
        // The end of typing sends the text again: no step of the history when nothing changed.
        const now = findBlock(list.root(), path)?.block[edit?.key ?? '']
        if (edit && JSON.stringify(now ?? null) !== JSON.stringify(edit.value ?? null)) list.set(path, edit.key, edit.value)
        // The typing ended: the page waits for its text in the draft before it shows the page again.
        if (message.end) changed()
        return
      }
      if (message.type === 'cms:builder:field') {
        const path = cmsBuilderPathOf(message)
        if (selectedPath.value?.join('/') !== path.join('/')) {
          selectedPath.value = path
          owner(path[0])?.reveal(path)
        }
        fieldRequest.value = { path, field: message.field, item: message.item ?? null, open: message.open === true, at: Date.now() }
        return
      }
      if (message.type === 'cms:builder:sources') {
        sources.value = { ...sources.value, [cmsBuilderPathOf(message).join('/')]: message.sources }
        return
      }
      if (message.type === 'cms:builder:entry-text') {
        pending.text(message.entity, message.id, message.at, message.value, message.end === true)
        return
      }
      if (message.type === 'cms:builder:value') {
        box.value = { entity: message.entity, id: message.id, values: message.values, rect: message.rect, at: Date.now() }
        void pending.open(message.entity, message.id)
        return
      }
      if (message.type === 'cms:builder:anchor') {
        // The page says where the element is now, or (`null`) that a press elsewhere in it lets go of the box.
        if (message.rect === null) box.value = null
        else if (box.value) box.value = { ...box.value, rect: message.rect }
        return
      }
      if (message.type === 'cms:builder:entry') {
        // The entry's own editor takes over: a box over one of its values closes.
        box.value = null
        if (message.open) {
          window.open(cmsBuilderEntryAddress(message.entity, message.id, !!entities.value[message.entity]?.global), '_blank', 'noopener')
          return
        }
        editEntry(message.entity, message.id, message.field ?? null)
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
export function provideCmsBuilder(on: Ref<boolean>, options: { locale?: Ref<string | null> } = {}): ShallowRef<CmsBuilder | null> {
  const bridge = shallowRef<CmsBuilder | null>(null)
  // Read now, in the editor's setup: the switch (and so the bridge) may come later.
  const { t, fieldLabel, entityLabel } = useCmsI18n()
  const { data: graph } = useNuxtData<any[]>('cms-graph')
  const toast = useToast()
  const deps: CmsBuilderDeps = {
    graph, locale: options.locale ?? ref(null), t: t as CmsBuilderDeps['t'], fieldLabel, entityLabel,
    notify: (title, description) => { toast.add({ title, description, icon: 'i-lucide-lock', color: 'neutral' }) },
  }
  watch(on, (value) => { if (value && !bridge.value) bridge.value = createBridge(deps) }, { immediate: true })
  provide(KEY, bridge)
  // The editor closes (or the page is left): the preview's drafts of the entries changed here are dropped.
  if (import.meta.client) {
    const drop = () => bridge.value?.pending.dispose()
    onMounted(() => window.addEventListener('pagehide', drop))
    onBeforeUnmount(() => {
      window.removeEventListener('pagehide', drop)
      drop()
    })
  }
  return bridge
}

/** The editor's bridge as a ref (`null` inside: the switch is off, or not known yet; outside an editor, a ref that stays `null`). */
export function useCmsBuilder(): ShallowRef<CmsBuilder | null> {
  return inject(KEY, NONE)
}

const LARGE_KEY = 'cms-preview-large'
/**
 * The preview takes the form's room (a narrow admin, where a desktop page is drawn small): remembered per
 * person in this browser. With the form hidden, a selected block's panel is a sheet over the preview's
 * left edge. Only while the editor in the preview is on.
 */
export function useCmsLargePreview(): { large: Ref<boolean>; toggle: () => void } {
  const large = useState<boolean>('cms-preview-large', () => false)
  onMounted(() => {
    try {
      large.value = localStorage.getItem(LARGE_KEY) === '1'
    }
    catch { /* storage blocked: as it is */ }
  })
  function toggle() {
    large.value = !large.value
    try {
      localStorage.setItem(LARGE_KEY, large.value ? '1' : '0')
    }
    catch { /* storage blocked: for this visit only */ }
  }
  return { large, toggle }
}

/**
 * Whether the editor in the preview is on for this site: the admin's menu says so (`builder`, only
 * when the server has NUXT_CMS_BUILDER=on). Reads the layout's own request; asks nothing itself.
 */
export function useCmsBuilderOn(): ComputedRef<boolean> {
  const { data } = useNuxtData<{ builder?: true }>('cms-menu')
  return computed(() => data.value?.builder === true)
}
