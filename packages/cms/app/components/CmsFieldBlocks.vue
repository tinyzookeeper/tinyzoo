<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { isLinkRef } from '../../src/linkref'
import type { CmsBuilderPath, CmsBuilderPlace } from '../../shared/builder'
import type { CmsBuilderRowInfo } from '../composables/useCmsBuilder'
import { cmsBindingRead, cmsBindingTypes } from '../utils/cmsBinding'
import { cmsCardBindingOf, cmsRefFields, type CmsCardBlock, type CmsCardBlockOf } from '../utils/cmsFieldRef'
import { cmsCardTypeOf } from '../utils/cmsCardType'
import {
  cardBindingFieldOf, cardBlockState, cardBlockWords, cardGroupCount, cardHiddenFields, cardOptionsOf, cardRefOf, type CardOptions, type CardWords,
} from '../../shared/builder-card'
import type { CmsCardOwner } from '../composables/useCmsCardEdit'
import {
  blankBlock, blockListField, blockListFull, blockListKinds, blockListMax, findBlock, isLockedBlock, keyOfPath, listOfPlaceIn, treeDuplicate, treeInsert, treeMove, treeRemove, treeSet, typingGroup, withNewIds,
  type BlockList,
} from '../../shared/block-tree'

// Page builder: an ordered list of typed blocks. Each block is a collapsible card —
// its type, a one-line summary when collapsed, and a marker when something inside
// needs attention. Insert between blocks or at the end through a searchable picker;
// move, duplicate and remove from the block's "…" menu (keyboard- and touch-friendly),
// or drag a block by its handle. A removed block can be brought back from the toast.
// `f.list()` uses the same editor with one item type: items read as their own text
// ("Jana Nováková · Coach"), not as "Item", and a `sub` switch indents an item
// under the one above (menus). A block can hold a list (FAQ questions, feature
// cards): the same editor again, inside the open block, under its full path
// ("sections.2.items"), so a problem in item 3 marks both the item and the block. An item
// of that list may hold a list of its own (a layout's group of small blocks): the same
// again, one level deeper ("sections.2.items.0.items"). A block's settings (`.setting()`)
// come after its content, under one heading. Ids, empty blocks, copies and limits come from
// shared/block-tree.ts, which the editor in the preview uses too.
//
// Since 3e a section made for one of the site's own types is named by that type (*Kurzy*) in its row, with the
// block type's label as the quiet line; and the list tells the phone-sized admin's sheet what a row of it says
// about a block (`rows`, `describe`).
const props = defineProps<{ field: any; entity: string; readOnly?: boolean }>()
// Text inside blocks is edited on its own (not shared), even on a shared entry.
provide('cmsCollab', null)
const model = defineModel<any[] | null>()
const { t, tl, fieldLabel, locale } = useCmsI18n()
const toast = useToast()
// The editor in the preview (experimental): the page-blocks field of a form registers with it and makes
// every change the page asks for, at any depth; a list inside a block follows what the page selects.
const builderRef = useCmsBuilder()
const root = ref<HTMLElement | null>(null)
const confirm = useCmsConfirm()
const form = inject<{ issues?: Record<string, string> } | null>('cmsForm', null)
const list = computed<{ max: number | null; itemLabel: any } | null>(() => props.field.meta?.list ?? null)
const max = computed(() => blockListMax(props.field))
const full = computed(() => blockListFull({ items: blocks.value, max: max.value }))

const defs = computed<Record<string, any>>(() => props.field.meta?.blocks ?? {})
const blocks = computed<any[]>(() => (Array.isArray(model.value) ? model.value : []))
const open = reactive<Record<string, boolean>>({})
// A list inside a block (or a group): its key is a path ("sections.0.items"). Empty, it says so in one line, not as a page would.
const inside = props.field.key.includes('.')
// Only a form's own list of page blocks registers with the editor in the preview: not a list (`f.list()`), not one inside a block.
const takesPart = !list.value && !inside
// A small block that names a field of the entries a card shows (`customTypeFieldRef`) finds the card's
// binding in the top-level block around it: the page's own list says where its blocks are, a list inside
// a block reads the binding of the block at the index its key names ("sections.3.items" is block 3).
const cardRoot = inside ? inject<{ key: string; blocks: () => any[]; defs: () => Record<string, any> } | null>('cmsCardRoot', null) : null
if (!inside) provide('cmsCardRoot', { key: props.field.key, blocks: () => blocks.value, defs: () => defs.value })
const cardSource = inside && cardRoot && props.field.key.startsWith(`${cardRoot.key}.`)
  ? computed(() => {
    const at = Number(props.field.key.slice(cardRoot.key.length + 1).split('.')[0])
    const top = Number.isInteger(at) ? cardRoot.blocks()[at] : undefined
    return top ? cmsCardBindingOf(top, cardRoot.defs()[top.type]) : undefined
  })
  : null
if (cardSource) provide('cmsCardSource', cardSource)
// The top-level block that holds the card, whole (a reference control reads the other blocks' fields from it).
const cardBlock = cardSource
  ? computed<CmsCardBlock | undefined>(() => {
    const at = Number(props.field.key.slice(cardRoot!.key.length + 1).split('.')[0])
    const top = Number.isInteger(at) ? cardRoot!.blocks()[at] : undefined
    const topDef = top ? cardRoot!.defs()[top.type] : undefined
    return top && cmsCardBindingOf(top, topDef) !== undefined ? { block: top, def: topDef, path0: top.id } : undefined
  })
  : null
if (cardBlock) provide('cmsCardBlock', cardBlock)
// A reference in a row's summary is named by the field's name in the card's type, never by its key.
const { data: cardGraph } = useNuxtData<any[]>('cms-graph')
const builderOn = useCmsBuilderOn()
const cardTypeNow = computed(() => cmsCardTypeOf(cardGraph.value, cmsBindingRead(cardSource?.value)?.type, tl, t('fieldRef.page'))?.type ?? null)
function refName(binding: unknown, key: string): string {
  const type = cmsBindingTypes(cardGraph.value).find((x) => x.name === cmsBindingRead(binding)?.type)
  const field = type ? cmsRefFields(type).find((f) => f.key === key) : undefined
  return field ? (field.kind === 'page' ? t('fieldRef.page') : tl(field.label as any, key)) : key
}
// A control that needs the block it is a field of (a reference: its own text, where it stands) finds it from its field's id.
provide<CmsCardBlockOf>('cmsCardBlockOf', (idPrefix) => {
  const b = blocks.value.find((x) => x && `${props.field.key}-${x.id}-` === idPrefix)
  return b ? { block: b, path: above.value ? [...above.value, b.id] : null } : undefined
})
/** The path (ids from the page's list down) of the block whose list this is: `[]` for the page's own list. */
const above = computed<CmsBuilderPath | null>(() => (takesPart ? [] : inside ? builderRef.value?.pathOf(props.field.key) ?? null : null))
const pathTo = (id: string): CmsBuilderPath | null => (above.value ? [...above.value, id] : null)
// The focus panel (the preview beside the form): a list of the page's blocks, at any depth, is a list of
// rows; a click selects the block, in the page too, and the form shows it alone (CmsBuilderPanel). A
// list of items (`f.list()`) keeps its rows that open in place.
// A list inside the panel of the phone-sized admin's sheet is rows too: the panel is there, the form is not beside it.
const inPanel = inject<boolean>('cmsInBuilderPanel', false)
const panelMode = computed(() => (!!builderRef.value?.panel.value || (inPanel && !!builderRef.value)) && !list.value && above.value !== null)
function opened(id: string) {
  const path = pathTo(id)
  if (path) builderRef.value?.opened(path)
}
/** A row of the focus panel's list: the block opens alone; opened with the keyboard (no pointer), the keyboard goes into the panel. */
function openRow(id: string, e: MouseEvent) {
  if (e.detail === 0 && builderRef.value) builderRef.value.focusPanel.value = true
  opened(id)
}
function toggle(id: string) {
  open[id] = !open[id]
  if (open[id]) opened(id)
}
// A link to a page is stored as a reference (`cms:page/<id>`): the collapsed row says which
// page it is (title and address), asked for in one batch like the expanded row does.
const { request: requestTargets, find: findTarget } = useCmsLinkTargets()
// (The lists inside a block too: a block that says nothing itself is summed up by them.)
watchEffect(() => {
  const refs: string[] = []
  const scan = (b: any, depth: number) => {
    for (const v of Object.values(b ?? {})) {
      if (typeof v === 'string' && isLinkRef(v)) refs.push(v)
      else if (Array.isArray(v) && depth < 2) for (const item of v) if (item && typeof item === 'object' && typeof item.type === 'string') scan(item, depth + 1)
    }
  }
  for (const b of blocks.value) scan(b, 0)
  if (refs.length) requestTargets(refs)
})

// The page-blocks field keeps the history of its changes (useCmsBuilder): every change is a step, typing
// in one field within a pause one step (typingGroup). A value put there from elsewhere (a newer version,
// a restored one) ends the history: its steps no longer fit.
let lastSet: unknown = null
let undoToast: string | number | null = null
/** Set the list's value; returns the step of the history it went into (the page-blocks field, with the editor in the preview on). */
function update(next: any[]): number | null {
  const bridge = builderRef.value
  let step: number | null = null
  if (bridge && takesPart) {
    const before = toRaw(blocks.value)
    step = bridge.history.record(props.field.key, before, next, typingGroup(defs.value, before, next))
    // A toast's *Undo* belongs to the step before this one.
    if (undoToast !== null) toast.remove(undoToast)
    undoToast = null
  }
  lastSet = next
  model.value = next
  return bridge ? step ?? bridge.history.top() : null
}
if (takesPart) {
  watch(() => toRaw(model.value), (value) => {
    if (lastSet !== null && value !== lastSet) builderRef.value?.history.clear()
    lastSet = value ?? null
  })
}
/** *Undo* on a toast: the history's undo when the editor in the preview keeps one (only while this is still the last step), else `fallback`. */
function undoAction(step: number | null, fallback: () => void) {
  return () => {
    const bridge = builderRef.value
    if (bridge && step !== null) bridge.history.undoStep(step)
    else fallback()
  }
}
function showUndo(message: Parameters<typeof toast.add>[0]) {
  const added = toast.add(message)
  if (takesPart) undoToast = added.id
}
/** Put `b` (a block built by the picker, or a blank one) at `index` of this list: one step of the history. Returns it. */
function insertBlockAt(index: number, b: any): number | null {
  if (full.value) return null
  const next = [...blocks.value]
  next.splice(index, 0, b)
  const step = update(next)
  // Only the new one opens: a page with many blocks stays readable.
  for (const k of Object.keys(open)) open[k] = false
  open[b.id] = true
  pickerOpen.value = false
  opened(b.id)
  builderRef.value?.changed()
  return step
}
function insertAt(index: number, type: string) {
  insertBlockAt(index, blankBlock(defs.value, type))
}
function move(index: number, by: number) {
  const next = [...blocks.value]
  const [b] = next.splice(index, 1)
  next.splice(index + by, 0, b)
  update(next)
}
function duplicate(index: number) {
  if (full.value) return
  // A new id for the copy and for every block inside it: no two blocks of a page share one.
  const copy = withNewIds(toRaw(blocks.value[index]))
  const next = [...blocks.value]
  next.splice(index + 1, 0, copy)
  update(next)
  open[copy.id] = true
  opened(copy.id)
}
function remove(index: number) {
  const next = [...blocks.value]
  const [gone] = next.splice(index, 1)
  const step = update(next)
  if (!gone) return
  showUndo({
    title: t('blocks.removed', { label: shortName(gone, index) }),
    icon: 'i-lucide-trash-2',
    actions: [{ label: t('blocks.undo'), color: 'neutral', variant: 'outline', onClick: undoAction(step, () => {
      const back = [...blocks.value]
      back.splice(Math.min(index, back.length), 0, gone)
      update(back)
    }) }],
  })
}

// ── the editor in the preview: what the page may ask of this field, at any depth (shared/block-tree.ts) ──
const tree = (): BlockList => ({ items: toRaw(blocks.value), defs: defs.value, max: max.value })
function builderCollapse() {
  for (const k of Object.keys(open)) open[k] = false
}
function scrollRow(id: string) {
  void nextTick(() => {
    const row = [...(root.value?.querySelectorAll<HTMLElement>('[data-cms-block-row]') ?? [])].find((el) => el.dataset.cmsBlockRow === id)
    // The selected block's panel takes the list's place (the editor in the preview): a smooth scroll to a row
    // nobody sees would end after the panel was shown from its top, and leave it scrolled down.
    if (!row || row.offsetParent === null || builderRef.value?.focused.value) return
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  })
}
function builderReveal(path: CmsBuilderPath) {
  // Called right after a change too: the value comes back through v-model on the next tick.
  if (!blocks.value.some((b) => b?.id === path[0])) {
    void nextTick(() => { if (blocks.value.some((b) => b?.id === path[0])) builderReveal(path) })
    return
  }
  builderRef.value?.lists.value.forEach((l) => l.collapse())
  open[path[0]!] = true
  // The rows inside open as their lists mount (or at once, when they are mounted already).
  builderRef.value?.open(path)
  if (path.length === 1) scrollRow(path[0]!)
}
/** A block's name in a list of `kinds`: its first text, else its type's label. */
function nameIn(b: any, kinds: Record<string, any>): string {
  const first = summaryOf(b, kinds).split(' · ')[0] ?? ''
  const name = first || tl(kinds[b?.type]?.label, String(b?.type ?? ''))
  return name.length > 40 ? `${name.slice(0, 39).trimEnd()}…` : name
}
function builderMove(path: CmsBuilderPath, place: CmsBuilderPlace) {
  if (props.readOnly) return
  const done = treeMove(tree(), path, place)
  if (!done) return
  const step = update(done.items)
  showUndo({
    title: t('blocks.moved'),
    icon: 'i-lucide-arrow-up-down',
    actions: [{ label: t('blocks.undo'), color: 'neutral', variant: 'outline', onClick: undoAction(step, () => {
      const undone = treeMove(tree(), done.path, done.back)
      if (!undone) return
      update(undone.items)
      builderRef.value?.changed()
    }) }],
  })
  // A block that went into another list stays selected there (the page selected it already, where it was dropped).
  if (done.path.join('/') !== path.join('/') && builderRef.value) {
    builderRef.value.selectedPath.value = done.path
    builderReveal(done.path)
  }
}
function builderDuplicate(path: CmsBuilderPath) {
  if (props.readOnly) return
  const done = treeDuplicate(tree(), path)
  if (!done) return
  update(done.items)
  builderReveal(done.path)
  builderRef.value?.opened(done.path)
}
function builderRemove(path: CmsBuilderPath) {
  const found = findBlock(tree(), path)
  if (props.readOnly || !found || isLockedBlock(found.list.defs, found.block)) return
  const done = treeRemove(tree(), path)
  if (!done) return
  const step = update(done.items)
  showUndo({
    title: t('blocks.removed', { label: nameIn(done.removed, found.list.defs) }),
    icon: 'i-lucide-trash-2',
    actions: [{ label: t('blocks.undo'), color: 'neutral', variant: 'outline', onClick: undoAction(step, () => {
      const back = treeInsert(tree(), done.place, done.removed)
      if (!back) return
      update(back)
      builderRef.value?.changed()
    }) }],
  })
}
/** Add a new block of `type` at `place` (in this field's value, at any depth), open it and select it on the page. */
function builderInsert(place: CmsBuilderPlace, type: string) {
  const into = listOfPlaceIn(tree(), place)
  if (props.readOnly || !into) return void (pickerOpen.value = false)
  builderInsertBlock(place, blankBlock(into.defs, type))
}
/** The same for a block that is built already; returns the step of the history it went into (null: nothing was added). */
function builderInsertBlock(place: CmsBuilderPlace, b: any): number | null {
  pickerOpen.value = false
  if (props.readOnly || !listOfPlaceIn(tree(), place)) return null
  const next = treeInsert(tree(), place, b)
  if (!next) return null
  const step = update(next)
  const path = [...(place.in ?? []), b.id]
  builderReveal(path)
  builderRef.value?.opened(path)
  builderRef.value?.changed()
  return step
}
function builderAdd(place: CmsBuilderPlace) {
  const into = listOfPlaceIn(tree(), place)
  if (props.readOnly || !into || blockListFull(into)) return
  const types = Object.keys(into.defs)
  const card = cardOf(place)
  if (types.length === 1 && !card) return builderInsert(place, types[0]!)
  pickerFor.value = { defs: into.defs, place, card }
  pickerOpen.value = true
}
if (takesPart) {
  watch(builderRef, (builder, _old, onCleanup) => {
    if (!builder || !import.meta.client) return
    const unregister = builder.register({
      key: props.field.key,
      root: tree,
      ids: () => blocks.value.map((b) => b?.id).filter((x): x is string => typeof x === 'string'),
      labels: () => Object.fromEntries(Object.entries(defs.value).map(([type, def]) => [type, tl(def.label, type)])),
      kinds: () => blockListKinds({ defs: defs.value, max: max.value }, (def, type) => tl(def.label as any, type), 4, (f) => fieldLabel({ key: f.key, meta: f.meta ?? undefined })),
      reveal: builderReveal, collapse: builderCollapse,
      move: builderMove, duplicate: builderDuplicate, remove: builderRemove, add: builderAdd,
      set(path, key, value) {
        const next = props.readOnly ? null : treeSet(tree(), path, key, value)
        return next ? update(next) : null
      },
      patch(path, values) {
        if (props.readOnly) return null
        let next: any[] | null = null
        for (const [key, value] of Object.entries(values)) next = treeSet({ ...tree(), items: next ?? tree().items }, path, key, value) ?? next
        return next ? update(next) : null
      },
      notice: showUndo,
      apply(items) {
        lastSet = items
        model.value = items
      },
      rows: () => blocks.value.filter((b) => typeof b?.id === 'string').map((b) => describeAt([b.id])).filter((x): x is CmsBuilderRowInfo => !!x),
      describe: describeAt,
    })
    onCleanup(unregister)
  }, { immediate: true })
}
// A list inside a block follows what the page selects: the row on the path opens (the others close),
// the last one comes into view. Asked for while this list was not mounted yet, it is done when it mounts.
if (inside && !list.value) {
  watch(() => builderRef.value?.openPath.value, (request) => {
    const at = above.value
    if (!request || !at || Date.now() - request.at > 2000) return
    const { path } = request
    if (path.length < at.length || !at.every((id, i) => path[i] === id)) return
    const mine = path[at.length]
    if (mine !== undefined && !blocks.value.some((b) => b?.id === mine)) return
    for (const k of Object.keys(open)) open[k] = false
    if (mine === undefined) return
    open[mine] = true
    if (path.length === at.length + 1) scrollRow(mine)
  }, { immediate: true })
}

/** One short name for a block (its first text, else its kind): for messages. */
function shortName(b: any, index: number): string {
  const first = summary(b).split(' · ')[0] ?? ''
  const name = first || itemLabel(b, index)
  return name.length > 40 ? `${name.slice(0, 39).trimEnd()}…` : name
}
/** A list item's name when it has no text yet: "Item 3". */
function itemLabel(b: any, index: number): string {
  return list.value ? `${tl(list.value.itemLabel ?? defs.value[b.type]?.label, t('blocks.item'))} ${index + 1}` : tl(defs.value[b.type]?.label, b.type)
}
const indented = (b: any) => !!list.value && b?.sub === true
// A block of a type the site no longer has, or one whose old shape could not be
// upgraded: kept as stored, shown as a card of its own (not editable), removable.
const isGone = (b: any) => !defs.value[b?.type]
const isStale = (b: any) => !isGone(b) && b?.__upgradeFailed === true
const isLocked = (b: any) => isGone(b) || isStale(b)
/** What a locked card is called: its kind's label when the site still has it, else the stored type. */
const lockedName = (b: any) => tl(defs.value[b?.type]?.label, String(b?.type || t('blocks.item')))
/**
 * What a locked block holds, so an editor can tell which one it is before removing it:
 * its first few texts, whatever their field names are (the site no longer describes them).
 */
function storedText(b: any): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(b ?? {})) {
    if (k === 'id' || k === 'type' || k === 'v' || k.startsWith('__')) continue
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
    else if (v && typeof v === 'object') {
      const text = JSON.stringify(v).match(/"text":"([^"]{1,120})/)?.[1]
      if (text) parts.push(text)
    }
    if (parts.length === 3) break
  }
  const joined = parts.join(' · ')
  return joined.length > 120 ? `${joined.slice(0, 119).trimEnd()}…` : joined
}
/** A block the site no longer has cannot be added again: removing it asks first (the others have "Undo"). */
async function removeLocked(index: number) {
  const b = blocks.value[index]
  if (isGone(b) && !(await confirm({
    title: t('blocks.removeGoneTitle', { type: b.type }), description: t('blocks.removeGoneBody'),
    icon: 'i-lucide-trash-2', color: 'error', confirmLabel: t('blocks.removeGoneConfirm'), cancelLabel: t('common.cancel'),
  }))) return
  remove(blocks.value.indexOf(b))
}

// Drag by the handle (the rest of the card stays clickable and selectable).
const armed = ref<string | null>(null)
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)
function onDrop(to: number) {
  const from = dragFrom.value
  dragFrom.value = dragOver.value = null
  armed.value = null
  // (the handle is not a button, so a locked field's fieldset does not stop it)
  if (props.readOnly || from === null || from === to) return
  const next = [...blocks.value]
  const [b] = next.splice(from, 1)
  next.splice(from < to ? to - 1 : to, 0, b)
  update(next)
}
/** A list inside block `index`, keyed by its full path (errors and ids find it). */
function nested(f: any, index: number) {
  return { ...f, key: `${props.field.key}.${index}.${f.key}` }
}
function setField(index: number, key: string, value: unknown) {
  // The type of a card section changes: its card follows, in the same step (with a notice).
  const section = blocks.value[index]
  if (builderOn.value && takesPart && section && cardEdit.change(toRaw(section), defs.value[section.type], key, value, cardOwner(index))) return
  const next = [...blocks.value]
  next[index] = { ...next[index], [key]: value }
  update(next)
}

/**
 * What the block says, for the collapsed header: its first few values, choices by their labels
 * ("Plavání · Úterý · 18:00"). Its settings are left out. A block that says nothing itself (a
 * layout that only holds small blocks) is summed up by what its lists hold: their texts, else
 * the names of their blocks ("Picture · Picture · Group"), so a layout of pictures has a line too.
 */
function summary(b: any): string {
  return summaryOf(b, defs.value)
}
function summaryOf(b: any, kinds: Record<string, any>, card: unknown = cardSource?.value): string {
  const parts: string[] = []
  const fields = kinds[b?.type]?.fields ?? []
  textsOf(b, fields, parts, 0, cmsCardBindingOf(b, kinds[b?.type]) ?? card)
  if (!parts.length) namesOf(b, fields, parts)
  return parts.join(' · ')
}
function namesOf(b: any, fields: any[], parts: string[]) {
  for (const f of fields) {
    if (f.type !== 'blocks' || f.meta?.list || !Array.isArray(b?.[f.key])) continue
    for (const item of b[f.key]) {
      if (parts.length >= 3) return
      const kind = f.meta?.blocks?.[item?.type]
      if (kind) parts.push(tl(kind.label, item.type))
    }
  }
}
function textsOf(b: any, fields: any[], parts: string[], depth: number, card?: unknown) {
  for (const f of fields) {
    if (parts.length >= 3) return
    if (f.meta?.setting) continue
    const v = b?.[f.key]
    if (f.meta?.format === 'field' && f.meta?.ref) { if (typeof v === 'string' && v.trim()) parts.push(refName(card, v.trim())) }
    else if (f.type === 'select' && typeof v === 'string' && v) parts.push(tl(f.meta?.labels?.[v], v))
    else if (typeof v === 'string' && isLinkRef(v)) {
      // Never the raw reference: the page's title and address once they are known.
      const target = findTarget(v)
      if (target) parts.push(target.state === 'missing' ? t('link.missingTitle') : [target.title, target.title && target.path ? `(${target.path})` : target.path].filter(Boolean).join(' '))
    }
    else if (typeof v === 'string' && v.trim() && f.type !== 'media') parts.push(v.trim())
    else if (f.type === 'richtext' && v?.content) {
      const text = JSON.stringify(v).match(/"text":"([^"]{1,120})/)?.[1]
      if (text) parts.push(text)
    }
  }
  if (parts.length || depth >= 2) return
  for (const f of fields) {
    if (f.type !== 'blocks' || !Array.isArray(b?.[f.key])) continue
    for (const item of b[f.key]) {
      if (parts.length >= 3) return
      textsOf(item, f.meta?.blocks?.[item?.type]?.fields ?? [], parts, depth + 1, card)
    }
  }
}
/** The fields of block `index` as its form shows them: the content first, then the settings (`.setting()`), each in their own order. */
function formFields(b: any, index: number): { content: any[]; settings: any[] } {
  let all = (defs.value[b?.type]?.fields ?? []).filter((x: any) => !(index === 0 && x.meta?.needsPrevious))
  // A block inside a card (editor in the preview on): what its reference says hides the fields that do not apply.
  const ref = builderOn.value && cardBlock?.value ? cardRefOf(defs.value[b?.type]) : null
  if (ref) {
    const hidden = cardHiddenFields(defs.value[b?.type], b, cardTypeNow.value)
    all = all.filter((x: any) => !hidden.has(x.key))
  }
  const content = all.filter((x: any) => !x.meta?.setting)
  // With no text of its own (a button) it asks for its other content first, then where it leads.
  if (ref && !ref.own) content.sort((a: any, b2: any) => Number(a.key === ref.key) - Number(b2.key === ref.key))
  return { content, settings: all.filter((x: any) => x.meta?.setting) }
}
/**
 * The server's refusal of the block as a whole ("saved by a newer version", "this type no
 * longer exists", fields the website does not know), shown on the block itself: those
 * issues have no field of their own, so they would otherwise only surface under the list.
 */
function blockIssue(index: number): string {
  const prefix = `${props.field.key}.${index}`
  const known = new Set<string>((defs.value[blocks.value[index]?.type]?.fields ?? []).map((f: any) => f.key))
  for (const [key, message] of Object.entries(form?.issues ?? {})) {
    if (key === prefix) return message
    if (key.startsWith(`${prefix}.`) && !known.has(key.slice(prefix.length + 1).split('.')[0]!)) return message
  }
  return ''
}
const hasIssue = (index: number) => Object.keys(form?.issues ?? {}).some((k) => k.startsWith(`${props.field.key}.${index}.`) || k === `${props.field.key}.${index}`)
const issueCount = (index: number) => Object.keys(form?.issues ?? {}).filter((k) => k.startsWith(`${props.field.key}.${index}.`) || k === `${props.field.key}.${index}`).length
// A block with a problem opens itself.
watch(() => ({ ...(form?.issues ?? {}) }), () => {
  blocks.value.forEach((b, i) => { if (hasIssue(i)) open[b.id] = true })
})

function menu(index: number): DropdownMenuItem[][] {
  return [
    [
      { label: t('blocks.moveUp'), icon: 'i-lucide-arrow-up', disabled: index === 0, onSelect: () => move(index, -1) },
      { label: t('blocks.moveDown'), icon: 'i-lucide-arrow-down', disabled: index === blocks.value.length - 1, onSelect: () => move(index, 1) },
      ...(isLocked(blocks.value[index]) || full.value ? [] : [{ label: t('blocks.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicate(index) }]),
    ],
    [{ label: t('blocks.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(index) }],
  ]
}

// ── picker (CmsBlockPicker) ──
const pickerOpen = ref(false)
const pickerAt = ref(0)
/** The picker asked for by the page: the types of the list it adds to (at any depth), the place and the card it is in. */
const pickerFor = ref<{ defs: Record<string, any>; place: CmsBuilderPlace; card: PickerCard | null } | null>(null)
type PickerCard = { type: string; options: CardOptions; items: unknown; topDefs: Record<string, any>; group: any | null; sectionId: string }
// One block type (e.g. menu links): no picker, the button names the type.
const onlyType = computed(() => {
  const types = Object.keys(defs.value)
  return types.length === 1 ? types[0]! : null
})

/** The card a list of the form is the list of (with the editor in the preview on): the card's own, or a group's in it. */
function cardIn(section: any, sectionDef: any, group: any | null): PickerCard | null {
  const field = blockListField(sectionDef)
  const type = cmsBindingRead(cmsCardBindingOf(section, sectionDef))?.type
  if (!field || !type || !cmsBindingTypes(cardGraph.value).some((x) => x.name === type)) return null
  return {
    type, options: cardOptionsOf(sectionDef), items: section[field.key], topDefs: (field.meta?.blocks ?? {}) as Record<string, any>,
    group, sectionId: String(section.id),
  }
}
/** The same for a place the page names: the page's own list resolves its first id to the section, a second to a group in it. */
function cardOf(place: CmsBuilderPlace): PickerCard | null {
  if (!builderOn.value || !takesPart || list.value) return null
  const path = place.in ?? []
  if (path.length < 1 || path.length > 2) return null
  const section = findBlock(tree(), [path[0]!])?.block
  const card = section ? cardIn(section, defs.value[section.type], null) : null
  if (!card || path.length === 1) return card
  const group = findBlock(tree(), path)?.block
  return group && isGroupOf(card, group) ? { ...card, group } : null
}
const isGroupOf = (card: PickerCard, group: any) => !!blockListField(card.topDefs[group?.type])
/** Where this list is in a card (the editor in the preview on): the card's own list (`group: null`) or a group's in it; `null` for any other list. */
const cardPlace = computed<{ top: boolean; group: any | null } | null>(() => {
  const owner = cardBlock?.value
  if (!builderOn.value || !owner || list.value || !cardRoot) return null
  const rest = props.field.key.slice(cardRoot.key.length + 1).split('.')
  if (rest[1] !== blockListField(owner.def)?.key || (rest.length !== 2 && rest.length !== 4)) return null
  return { top: rest.length === 2, group: rest.length === 2 ? null : owner.block[rest[1]!]?.[Number(rest[2])] ?? null }
})
/** This list, when it is the card's or a group's list in the form (a nested list; `cardBlock` knows the section it is in). */
const formCard = computed<PickerCard | null>(() => {
  const owner = cardBlock?.value
  const place = cardPlace.value
  if (!owner || !place) return null
  const card = cardIn(owner.block, owner.def, null)
  if (!card || place.top) return card
  return place.group && isGroupOf(card, place.group) ? { ...card, group: place.group } : null
})
const activeCard = computed(() => (pickerFor.value ? pickerFor.value.card : formCard.value))
/** Adding a section to the page: the section that is made for the site's own types, when the site has them. */
const sectionChoice = computed(() => {
  if (!builderOn.value || !takesPart || list.value || (pickerFor.value && (pickerFor.value.place.in ?? []).length)) return null
  if (!cmsBindingTypes(cardGraph.value).length) return null
  const defType = Object.keys(defs.value).find((type) => cardBindingFieldOf(defs.value[type]) && blockListField(defs.value[type]))
  return defType ? { defType } : null
})
/** The language of the values a design fixes: the page's own, else the content's default, else the admin's. */
const contentLang = computed(() => builderRef.value?.locale.value
  ?? cardGraph.value?.find((e) => e?.name === props.entity)?.locales?.default
  ?? locale.value)

// ── a card's section and its rows (part 3c) ──
const cardEdit = useCmsCardEdit(() => contentLang.value)
/** How a card section is written by this list: several keys in one step; *Undo* is the history's. */
function cardOwner(index: number): CmsCardOwner {
  const before = blocks.value[index]
  return {
    apply(values) {
      const next = [...blocks.value]
      next[index] = { ...next[index], ...values }
      return update(next)
    },
    undo: (step) => undoAction(step, () => {
      const back = [...blocks.value]
      if (before) back[Math.min(index, back.length - 1)] = before
      update(back)
    }),
    notify: showUndo,
  }
}
const isCardSection = (b: any) => builderOn.value && takesPart && !!cardBindingFieldOf(defs.value[b?.type])
/** The card's blocks of a section that show nothing on the website. */
const sectionUnbound = (b: any): number => (isCardSection(b) ? cardEdit.unboundOf(b, defs.value[b?.type]).length : 0)
/** What a block of a card says it shows (this list is a card's or a group's): its text, its look and whether it shows nothing; null elsewhere. */
const cardWords = computed((): CardWords => ({
  unbound: t('card.rowUnbound'),
  noPages: t('card.rowNoPages'),
  missing: (name) => t('card.rowMissing', { name }),
  unfit: (name) => t('card.rowUnfit', { name }),
  own: t('card.own'),
  groupBlocks: (count) => t('card.groupBlocks', { count }),
  groupEmpty: t('card.groupEmpty'),
}))
function cardRow(b: any, kinds: Record<string, any> = defs.value): { text: string; cls: string; warn: boolean } | null {
  if (!cardPlace.value) return null
  const state = cardBlockState(b, kinds[b?.type], cardTypeNow.value)
  if (state.state === 'other') return null
  const w = cardBlockWords(state, locale.value, cardWords.value, state.state === 'group' ? cardGroupCount(b, kinds[b?.type]) : 0)
  const cls = w.tone === 'warn' ? 'text-warning font-medium' : w.tone === 'field' ? 'text-primary' : 'text-muted'
  return { text: w.shows, cls, warn: w.warn }
}
/** In the focus panel the blocks of a group stand right under its row, smaller and indented, so the whole card is seen at once. */
function groupKids(b: any): { id: string; icon: string; label: string; row: ReturnType<typeof cardRow> }[] {
  const place = cardPlace.value
  const inner = place?.top && panelMode.value ? blockListField(defs.value[b?.type]) : null
  if (!inner || !Array.isArray(b?.[inner.key])) return []
  const kinds = (inner.meta?.blocks ?? {}) as Record<string, any>
  return b[inner.key].filter((c: any) => c && typeof c.id === 'string' && kinds[c.type]).map((c: any) => ({
    id: c.id, icon: kinds[c.type]?.icon ?? 'i-lucide-square', label: tl(kinds[c.type]?.label, c.type), row: cardRow(c, kinds),
  }))
}
function openKid(groupId: string, kidId: string, e: MouseEvent) {
  const at = pathTo(groupId)
  if (!at || !builderRef.value) return
  if (e.detail === 0) builderRef.value.focusPanel.value = true
  builderRef.value.select([...at, kidId])
}

/**
 * A section bound to one of the site's own types (editor in the preview on): the type's name, icon and limit, and
 * the block type's label, which is the quiet line. `null` for any other block, and when the graph has no such type.
 */
function cardSectionOf(b: any, kinds: Record<string, any> = defs.value) {
  if (!builderOn.value || !takesPart || list.value || !cardBindingFieldOf(kinds[b?.type])) return null
  const binding = cmsBindingRead(cmsCardBindingOf(b, kinds[b?.type]))
  const found = cmsCardTypeOf(cardGraph.value, binding?.type, tl, t('fieldRef.page'))
  return found && binding ? { name: found.meta.label, icon: found.meta.icon, type: found.type, limit: binding.limit ?? null, label: tl(kinds[b.type]?.label, b.type) } : null
}
/** What a row (or the sheet's handle) says about the block at `path`, at any depth of this list. */
function describeAt(path: CmsBuilderPath): CmsBuilderRowInfo | null {
  const found = findBlock(tree(), path)
  if (!found) return null
  const b = found.block
  const kinds = found.list.defs as Record<string, any>
  const top = path.length === 1 ? cardSectionOf(b) : null
  const section = path.length > 1 ? findBlock(tree(), [path[0]!]) : null
  const around = section ? cardSectionOf(section.block) : null
  // A block of a card, or of a group in it: what it shows from the entry.
  let words: ReturnType<typeof cardBlockWords> | null = null
  if (around && section && (path.length === 2 || path.length === 3)) {
    const field = blockListField(section.list.defs[section.block.type])
    const topDefs = (field?.meta?.blocks ?? {}) as Record<string, any>
    const inGroup = path.length === 3 ? !!blockListField(topDefs[findBlock(tree(), path.slice(0, 2))?.block.type ?? '']) : true
    const state = inGroup ? cardBlockState(b, kinds[b?.type], around.type) : { state: 'other' as const }
    if (state.state !== 'other') words = cardBlockWords(state, locale.value, cardWords.value, state.state === 'group' ? cardGroupCount(b, kinds[b?.type]) : 0)
  }
  const key = keyOfPath(props.field.key, tree(), path)
  const issues = key ? Object.keys(form?.issues ?? {}).filter((k) => k === key || k.startsWith(`${key}.`)).length : 0
  const own = cmsBindingRead(cmsCardBindingOf(b, kinds[b?.type]))
  return {
    id: String(b?.id),
    icon: top?.icon ?? kinds[b?.type]?.icon ?? 'i-lucide-square',
    name: top?.name ?? tl(kinds[b?.type]?.label, String(b?.type ?? '')),
    kind: top?.label ?? null,
    shows: words?.shows ?? summaryOf(b, kinds, cmsCardBindingOf(section?.block, section?.list.defs[section.block.type])),
    cardType: top ? own?.type ?? null : null,
    limit: top ? top.limit : null,
    unbound: path.length === 1 ? sectionUnbound(b) : 0,
    issues,
    warn: words?.warn ?? false,
  }
}

// A list says "Add item" (a label like "Opening hours" doesn't bend into a sentence); a card's, "Add to the card".
const addLabel = computed(() => {
  if (formCard.value) return t(formCard.value.group ? 'card.addToGroup' : 'card.addToCard')
  return list.value ? t('blocks.addItem') : onlyType.value ? t('blocks.addType', { label: tl(defs.value[onlyType.value]?.label, onlyType.value) }) : t('blocks.add')
})
const pickerTitle = computed(() => {
  const card = activeCard.value
  return card ? t(card.group ? 'card.addToGroup' : 'card.addToCard') : t('blocks.pickerTitle')
})
function openPicker(at: number) {
  if (onlyType.value && !formCard.value) return insertAt(at, onlyType.value)
  pickerFor.value = null
  pickerAt.value = at
  pickerOpen.value = true
}
function choose(type: string) {
  if (pickerFor.value) builderInsert(pickerFor.value.place, type)
  else insertAt(pickerAt.value, type)
}
/** A block the picker built: a section made from a type (with a quiet note and *Undo*), or a block of a card. */
function chooseBuilt(block: any, designed: string | null) {
  const step = pickerFor.value ? builderInsertBlock(pickerFor.value.place, block) : insertBlockAt(pickerAt.value, block)
  if (!designed || step === null) return
  showUndo({
    title: t('card.designed', { type: designed }),
    icon: 'i-lucide-sparkles',
    actions: [{ label: t('blocks.undo'), color: 'neutral', variant: 'outline', onClick: undoAction(step, () => {
      const gone = treeRemove(tree(), [block.id])
      if (gone) update(gone.items)
    }) }],
  })
}
watch(pickerOpen, (value) => { if (!value) pickerFor.value = null })
</script>

<template>
  <div ref="root" class="space-y-2">
    <CmsEmptyState
      v-if="!blocks.length && !onlyType && !inside" plain icon="i-lucide-layout-template" :title="t('blocks.emptyTitle')" :description="t('blocks.emptyDescription')"
      class="rounded-(--ui-radius) border border-dashed border-accented !py-10"
    >
      <template #actions>
        <UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="openPicker(0)">{{ t('blocks.emptyAction') }}</UButton>
      </template>
    </CmsEmptyState>
    <p v-else-if="!blocks.length" class="text-sm text-muted">{{ t('blocks.emptyGeneric') }}</p>

    <template v-for="(b, i) in blocks" :key="b.id">
      <!-- insertion point between blocks -->
      <div v-if="i > 0" class="group relative h-2 -my-1 flex items-center justify-center">
        <button
          v-if="!full" type="button" class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity size-5 rounded-full border border-default bg-default grid place-items-center text-muted hover:text-highlighted z-10"
          :aria-label="t('blocks.insertHere')" @click="openPicker(i)"
        >
          <UIcon name="i-lucide-plus" class="size-3" />
        </button>
        <span class="absolute inset-x-0 top-1/2 h-px bg-transparent group-hover:bg-(--ui-border)" aria-hidden="true" />
      </div>

      <!-- a block the site no longer knows (or could not bring up to date): kept, not editable -->
      <div
        v-if="isLocked(b)" role="group" :aria-label="lockedName(b)" data-cms-block-locked :data-cms-block-row="above && builderRef ? b.id : undefined"
        class="cms-card flex items-start gap-3 px-3 py-3" :class="[blockIssue(i) ? 'border-error' : 'border-warning/60', indented(b) ? 'ml-6' : '']"
      >
        <UIcon name="i-lucide-triangle-alert" class="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div class="min-w-0 flex-1 space-y-0.5">
          <p class="text-sm font-medium text-highlighted">{{ t(isGone(b) ? 'blocks.gone' : 'blocks.stale', { type: lockedName(b) }) }}</p>
          <p v-if="storedText(b)" class="line-clamp-2 break-words text-xs text-toned">{{ t('blocks.storedContent', { text: storedText(b) }) }}</p>
          <p class="text-xs text-muted">{{ t(isGone(b) ? 'blocks.goneHelp' : 'blocks.staleHelp') }}</p>
          <p v-if="blockIssue(i)" role="alert" class="pt-1 text-xs font-medium text-error">{{ blockIssue(i) }}</p>
        </div>
        <UButton
          color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" class="shrink-0 pointer-coarse:min-h-11"
          :aria-label="t('blocks.removeNamed', { name: lockedName(b) })" @click="removeLocked(i)"
        >{{ t('blocks.remove') }}</UButton>
      </div>
      <div
        v-else class="cms-card transition-[margin,box-shadow]" :data-cms-block-row="above && builderRef ? b.id : undefined"
        :class="[hasIssue(i) ? 'border-error' : '', indented(b) ? 'ml-6' : '', dragOver === i && dragFrom !== i ? 'ring-2 ring-(--ui-primary)/40' : '', dragFrom === i ? 'opacity-50' : '']"
        :draggable="!readOnly && armed === b.id"
        @dragstart.stop="(e: DragEvent) => { dragFrom = i; e.dataTransfer?.setData('text/plain', b.id) }"
        @dragover.prevent.stop="dragFrom !== null && (dragOver = i)" @dragleave.stop="dragOver === i && (dragOver = null)"
        @drop.prevent.stop="onDrop(dragOver !== null && dragFrom !== null && dragOver > dragFrom ? i + 1 : i)"
        @dragend.stop="dragFrom = dragOver = null; armed = null"
      >
        <div class="flex items-center gap-2 pl-1.5 pr-1.5 py-2">
          <span
            v-if="blocks.length > 1" class="cursor-grab touch-none text-dimmed hover:text-muted shrink-0 p-1" :title="t('blocks.drag')" aria-hidden="true"
            @pointerdown="armed = readOnly ? null : b.id" @pointerup="armed = null"
          ><UIcon name="i-lucide-grip-vertical" class="size-4" /></span>
          <button
            type="button" class="flex flex-1 min-w-0 items-center gap-2.5 text-left"
            :aria-expanded="panelMode ? undefined : !!open[b.id]"
            @click="(e: MouseEvent) => panelMode ? openRow(b.id, e) : toggle(b.id)"
          >
            <UIcon v-if="!panelMode" name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0 transition-transform" :class="open[b.id] ? 'rotate-90' : ''" />
            <template v-if="list">
              <UIcon v-if="indented(b)" name="i-lucide-corner-down-right" class="size-4 text-dimmed shrink-0" />
              <span class="text-sm font-medium text-highlighted truncate">{{ summary(b) || itemLabel(b, i) }}</span>
            </template>
            <template v-else>
              <UIcon :name="cardSectionOf(b)?.icon ?? defs[b.type]?.icon ?? 'i-lucide-square'" class="size-4 text-muted shrink-0" />
              <span class="text-sm font-medium text-highlighted shrink-0">{{ cardSectionOf(b)?.name ?? tl(defs[b.type]?.label, b.type) }}</span>
              <span v-if="cardRow(b)" class="min-w-0 truncate text-sm" :class="cardRow(b)!.cls">{{ cardRow(b)!.text }}</span>
              <span v-else-if="cardSectionOf(b) && (panelMode || !open[b.id])" class="text-sm text-muted truncate">{{ cardSectionOf(b)!.label }}</span>
              <span v-else-if="(panelMode || !open[b.id]) && summary(b)" class="text-sm text-muted truncate">{{ summary(b) }}</span>
            </template>
            <span v-if="sectionUnbound(b)" class="ml-auto shrink-0 inline-flex items-center gap-1 text-xs font-medium text-warning">
              <span class="size-1.5 rounded-full bg-warning" aria-hidden="true" />{{ t('card.unboundShort', { count: sectionUnbound(b) }) }}
            </span>
            <span v-else-if="cardRow(b)?.warn" class="ml-auto shrink-0 size-1.5 rounded-full bg-warning" aria-hidden="true" />
            <span v-if="hasIssue(i)" :class="sectionUnbound(b) || cardRow(b)?.warn ? 'ml-3' : 'ml-auto'" class="shrink-0 inline-flex items-center gap-1 text-xs text-error">
              <span class="size-1.5 rounded-full bg-error" aria-hidden="true" />{{ panelMode ? t('builderPanel.toFix', { count: issueCount(i) }) : t('blocks.hasErrors') }}
            </span>
            <UIcon v-if="panelMode" name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0" :class="hasIssue(i) || sectionUnbound(b) || cardRow(b)?.warn ? 'ml-2' : 'ml-auto'" aria-hidden="true" />
          </button>
          <UDropdownMenu :items="menu(i)" :content="{ align: 'end' }">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-ellipsis" class="pointer-coarse:size-11" :aria-label="t('blocks.actions')" />
          </UDropdownMenu>
        </div>
        <div v-if="open[b.id] && !panelMode" class="border-t border-default px-4 py-4 space-y-5">
          <p v-if="blockIssue(i)" role="alert" class="flex items-start gap-1.5 text-sm text-error">
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />{{ blockIssue(i) }}
          </p>
          <p v-if="!defs[b.type]" class="text-sm text-muted">{{ b.type }}</p>
          <CmsCardNotices
            v-if="isCardSection(b)" :section="b" :def="defs[b.type]" :read-only="readOnly"
            @drop="cardEdit.dropUnbound(toRaw(b), defs[b.type], cardOwner(i))" @redesign="cardEdit.redesign(toRaw(b), defs[b.type], cardOwner(i))"
          />
          <CmsField
            v-for="f in formFields(b, i).content" :key="f.key"
            :model-value="b[f.key]" :field="f.type === 'blocks' || f.type === 'group' ? nested(f, i) : f" :entity="entity" :id-prefix="`${field.key}-${b.id}-`"
            :error="form?.issues?.[`${field.key}.${i}.${f.key}`]"
            @update:model-value="(v: unknown) => setField(i, f.key, v)"
          />
          <!-- the block's settings: after its content, under one quiet heading -->
          <div v-if="formFields(b, i).settings.length" role="group" :aria-labelledby="`${field.key}-${b.id}-settings`" class="pt-1">
            <h3 :id="`${field.key}-${b.id}-settings`" class="mb-3 text-sm font-medium text-muted">{{ t('blocks.settings') }}</h3>
            <div class="space-y-5">
              <CmsField
                v-for="f in formFields(b, i).settings" :key="f.key"
                :model-value="b[f.key]" :field="f.type === 'blocks' || f.type === 'group' ? nested(f, i) : f" :entity="entity" :id-prefix="`${field.key}-${b.id}-`"
                :error="form?.issues?.[`${field.key}.${i}.${f.key}`]"
                @update:model-value="(v: unknown) => setField(i, f.key, v)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- the blocks of a group, right under its row (the focus panel) -->
      <ul v-if="groupKids(b).length" class="ml-6 space-y-1 -mt-0.5" :aria-label="tl(defs[b.type]?.label, b.type)">
        <li v-for="c in groupKids(b)" :key="c.id">
          <button
            type="button" class="cms-card flex h-9 w-full min-w-0 items-center gap-2 px-2.5 text-left text-xs pointer-coarse:h-11 transition-colors hover:bg-elevated/60"
            @click="(e: MouseEvent) => openKid(b.id, c.id, e)"
          >
            <UIcon :name="c.icon" class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
            <span class="shrink-0 font-medium text-highlighted">{{ c.label }}</span>
            <span v-if="c.row" class="min-w-0 truncate" :class="c.row.cls">{{ c.row.text }}</span>
            <span v-if="c.row?.warn" class="ml-auto size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0 text-dimmed" :class="c.row?.warn ? '' : 'ml-auto'" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </template>

    <UButton v-if="(blocks.length || onlyType || inside) && !full" color="neutral" variant="ghost" icon="i-lucide-plus" size="sm" @click="openPicker(blocks.length)">
      {{ addLabel }}
    </UButton>
    <p v-if="panelMode && takesPart && blocks.length" class="flex items-start gap-1.5 text-xs text-muted">
      <UIcon name="i-lucide-mouse-pointer-click" class="mt-px size-3.5 shrink-0 text-dimmed" aria-hidden="true" />{{ t('builderPanel.hint') }}
    </p>

    <CmsBlockPicker
      v-model:open="pickerOpen" :defs="pickerFor?.defs ?? defs" :title="pickerTitle" :lang="contentLang"
      :sections="sectionChoice" :card="activeCard" @choose="choose" @insert="chooseBuilt"
    />
  </div>
</template>
