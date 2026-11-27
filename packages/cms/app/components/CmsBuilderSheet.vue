<script setup lang="ts">
// The editor in the preview (experimental, NUXT_CMS_BUILDER=on) on a phone-sized admin, since 3e: the
// selected block's panel as a sheet at the bottom of the preview (the full-screen modal), drawn by
// CmsPreviewPanel. The form behind the modal stays the plain accordion; this is the only panel there.
//
// The handle is one button: a grab bar, the block's icon and name, one quiet line of what it shows, and a
// chevron. A tap opens and closes it; a drag down on the open sheet closes it, a drag up on the closed handle
// opens it. Nothing selected: it says "Page sections", and opened it lists them (a tap selects one, in the
// page too) with *Add block*. A section or a block selected: the body is CmsBuilderPanel, without its title
// row (the handle has it).
//
// When it opens and closes: a block inside a section picked in the page opens it and it follows the next one;
// a section or nothing picked in the page leaves the handle only; a selection made inside it keeps it as it is
// (shared/builder-sheet.ts). A field the page asks for (a tap on a picture) opens it. A text typed in the page
// closes it to its handle, so the keyboard has room, and brings it back after. Escape goes up a level, then
// closes it, and only then closes the preview.
//
// It tells the preview its shape (`shape`): whether it is open, its height and its handle's, so the stage keeps
// the closed handle's room free and the page knows how much of it the open sheet covers. It raises the
// toasts above itself (a variable and a mark on <html>, cms-admin.css).
import type { Ref } from 'vue'
import { cardRepeatCount } from '../../shared/builder-card'
import { cmsSheetAfterSelect, cmsSheetDragEnd, cmsSheetDragOffset } from '../../shared/builder-sheet'
import type { CmsBuilderRowInfo } from '../composables/useCmsBuilder'

const props = defineProps<{ entity: string }>()
const emit = defineEmits<{ shape: [shape: { open: boolean; handle: number; height: number }] }>()
const { t } = useCmsI18n()
const builder = useCmsBuilder()
const readOnly = inject<Ref<boolean> | null>('cmsReadOnly', null)
const bodyId = useId()

const root = ref<HTMLElement | null>(null)
const handle = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)

// ── open or closed ──
const open = ref(false)
/** A tap opened it while the page was typing: it stays, whatever the page says, until the page says something else. */
const forced = ref(false)
const typing = computed(() => builder.value?.typing.value === true)
const shown = computed(() => open.value && (!typing.value || forced.value))
watch(typing, () => { forced.value = false })
function setOpen(value: boolean) {
  open.value = value
  forced.value = value && typing.value
}
// It never animates on load: the movement is turned on after the first frame.
const ready = ref(false)
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => { ready.value = true })))

const path = computed(() => builder.value?.selectedPath.value ?? null)
const at = computed(() => path.value?.join('/') ?? '')
/** Until then a selection that comes from the page is a reply to a key sent from here: it keeps the sheet as it is. */
let keepUntil = 0
watch(at, () => {
  const bridge = builder.value
  if (!bridge) return
  const from = bridge.selectedBy.value === 'admin' || Date.now() < keepUntil ? 'inside' : 'page'
  setOpen(cmsSheetAfterSelect(from, path.value?.length ?? 0, open.value))
  void nextTick(() => { body.value?.scrollTo({ top: 0 }) })
})
// A field the page asked for (a picture, a rich text) is in the panel: show it. (After the selection's watcher: its last word.)
watch(() => builder.value?.fieldRequest.value ?? null, (request) => { if (request && Date.now() - request.at < 2000) setOpen(true) })

// ── what the handle and the list say ──
const lists = computed(() => builder.value?.lists.value ?? [])
const rows = computed(() => lists.value.flatMap((l) => l.rows?.() ?? []))
function describe(p: readonly string[]): CmsBuilderRowInfo | null {
  for (const l of lists.value) {
    const found = l.describe?.([...p])
    if (found) return found
  }
  return null
}
const info = computed(() => (path.value ? describe(path.value) : null))
// A card section: how often its card repeats, as the panel counts it.
const section = computed(() => (path.value?.length === 1 ? info.value : null))
const cardName = computed(() => section.value?.cardType ?? null)
const card = useCmsCardType(cardName)
const repeat = computed(() => {
  if (!cardName.value || !card.type.value) return null
  const shownNow = builder.value?.sources.value[at.value]?.find((x) => x.entity === cardName.value)?.entries.length
  return cardRepeatCount(shownNow ?? null, card.total.value, section.value?.limit)
})
const head = computed(() => {
  const p = path.value
  if (!p) return { icon: 'i-lucide-layout-template', title: t('builderPanel.sheetPage'), line: t('builderPanel.sheetSections', { count: rows.value.length }) }
  const i = info.value
  if (!i) return { icon: 'i-lucide-square', title: builder.value?.selection.value?.along.at(-1)?.label ?? '', line: '' }
  let line = i.shows
  if (i.kind !== null) {
    line = repeat.value === null ? i.kind : repeat.value > 0 ? t('card.quietLineOf', { label: i.kind, count: repeat.value }) : t('card.quietNoneOf', { label: i.kind })
  }
  else if (!line) line = p.length === 1 ? t('builderPanel.ofPage') : t('builderPanel.inBlock', { name: describe(p.slice(0, -1))?.name ?? '' })
  return { icon: i.icon, title: i.name, line }
})

// ── the list of sections ──
function pick(id: string) {
  builder.value?.select([id])
}
function add() {
  const list = lists.value[0]
  if (!list || readOnly?.value) return
  const last = rows.value.at(-1)
  list.add(last ? { after: last.id } : { end: true, in: [] })
}

// ── tap and drag on the handle ──
const dragging = ref(false)
const dragY = ref(0)
let start: { y: number; id: number } | null = null
let moved = false
function onDown(e: PointerEvent) {
  if (e.button > 0) return
  start = { y: e.clientY, id: e.pointerId }
  moved = false
}
function onMove(e: PointerEvent) {
  if (!start || e.pointerId !== start.id) return
  const dy = e.clientY - start.y
  if (!dragging.value) {
    if (Math.abs(dy) < 6) return
    dragging.value = true
    moved = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  dragY.value = cmsSheetDragOffset(shown.value, dy)
}
function onUp(e: PointerEvent) {
  if (!start || e.pointerId !== start.id) return
  const dy = e.clientY - start.y
  const was = dragging.value
  start = null
  if (!was) return
  dragging.value = false
  dragY.value = 0
  const end = cmsSheetDragEnd(shown.value, dy)
  if (end === 'open') setOpen(true)
  else if (end === 'close') setOpen(false)
}
function onCancel() {
  start = null
  dragging.value = false
  dragY.value = 0
}
function onClick(e: MouseEvent) {
  // The click that ends a drag is no tap.
  if (moved) {
    moved = false
    e.preventDefault()
    return
  }
  setOpen(!shown.value)
}

// ── Escape ──
/**
 * Escape goes up a level (the page answers with the new selection), then closes the sheet, and only then the
 * preview. A capture listener: the preview is a dialog, and its own Escape must not take the key first. Text
 * fields, menus and lists, and a dialog above the preview (the picker, the entry's sheet) keep their keys.
 */
function onKey(e: KeyboardEvent) {
  const bridge = builder.value
  if (!bridge || e.key !== 'Escape' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="menu"], [role="listbox"], [role="radiogroup"], [data-cms-no-builder-keys]')) return
  const dialog = target?.closest('[role="dialog"]')
  if (dialog && root.value && !dialog.contains(root.value)) return
  if (bridge.selectedPath.value) {
    keepUntil = Date.now() + 800
    bridge.send({ type: 'cms:builder:key', key: 'Escape' })
  }
  else if (shown.value) setOpen(false)
  else return
  e.preventDefault()
  e.stopPropagation()
}

// ── its shape, for the preview and the toasts ──
let sizes: ResizeObserver | null = null
function report() {
  const box = root.value
  const grip = handle.value
  if (!box || !grip) return
  const shape = { open: shown.value, handle: grip.offsetHeight, height: box.offsetHeight }
  emit('shape', shape)
  document.documentElement.style.setProperty('--cms-sheet-covers', `${shape.open ? shape.height : shape.handle}px`)
}
watch(shown, report, { flush: 'post' })
onMounted(() => {
  document.documentElement.setAttribute('data-cms-sheet', '')
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', report)
  if (typeof ResizeObserver !== 'undefined') {
    sizes = new ResizeObserver(report)
    if (root.value) sizes.observe(root.value)
    if (handle.value) sizes.observe(handle.value)
  }
  report()
})
onBeforeUnmount(() => {
  sizes?.disconnect()
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', report)
  document.documentElement.removeAttribute('data-cms-sheet')
  document.documentElement.style.removeProperty('--cms-sheet-covers')
})
</script>

<template>
  <div
    ref="root" class="cms-sheet" data-cms-builder-sheet
    :class="[shown ? 'cms-sheet--open' : '', ready ? 'cms-sheet--ready' : '', dragging ? 'cms-sheet--drag' : '']"
    :style="{ '--cms-sheet-drag': `${dragY}px` }"
  >
    <button
      ref="handle" type="button" class="cms-sheet__handle" :aria-expanded="shown" :aria-controls="bodyId"
      @click="onClick" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel"
    >
      <span class="cms-sheet__grab" aria-hidden="true" />
      <span class="cms-sheet__icon"><UIcon :name="head.icon" class="size-[1.125rem]" aria-hidden="true" /></span>
      <span class="cms-sheet__text">
        <b>{{ head.title }}</b>
        <span>{{ head.line }}</span>
      </span>
      <UIcon name="i-lucide-chevron-up" class="cms-sheet__chev size-5 shrink-0" aria-hidden="true" />
    </button>
    <div :id="bodyId" ref="body" class="cms-sheet__body" :inert="shown ? undefined : true">
      <CmsBuilderPanel v-if="path" :key="at" :entity="props.entity" :read-only="!!readOnly" in-sheet />
      <template v-else>
        <ul v-if="rows.length" class="cms-sheet__rows">
          <li v-for="r in rows" :key="r.id" class="cms-card">
            <button type="button" class="cms-sheet__row" @click="pick(r.id)">
              <UIcon :name="r.icon" class="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span class="cms-sheet__name">{{ r.name }}</span>
              <span v-if="r.kind ?? r.shows" class="min-w-0 flex-1 truncate text-sm text-muted">{{ r.kind ?? r.shows }}</span>
              <span v-else class="flex-1" />
              <span v-if="r.unbound" class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-warning">
                <span class="size-1.5 rounded-full bg-warning" aria-hidden="true" />{{ t('card.unboundShort', { count: r.unbound }) }}
              </span>
              <span v-if="r.issues" class="inline-flex shrink-0 items-center gap-1 text-xs text-error">
                <span class="size-1.5 rounded-full bg-error" aria-hidden="true" />{{ t('builderPanel.toFix', { count: r.issues }) }}
              </span>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <UButton v-if="!readOnly" class="mt-2 pointer-coarse:min-h-11" color="neutral" variant="ghost" icon="i-lucide-plus" size="sm" @click="add">{{ t('blocks.add') }}</UButton>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cms-sheet {
  --cms-handle: calc(3.5rem + env(safe-area-inset-bottom, 0px));
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  display: flex; flex-direction: column; max-height: 58dvh; margin-inline: auto;
  background: var(--ui-bg); border-top: 1px solid var(--ui-border); border-radius: 1.125rem 1.125rem 0 0;
  box-shadow: 0 -12px 30px -14px rgb(0 0 0 / 0.3);
  /* Closed, only the handle shows; open, it rests on the screen's edge. */
  transform: translateY(calc(100% - var(--cms-handle) - 1px + var(--cms-sheet-drag, 0px)));
}
.cms-sheet--open { transform: translateY(var(--cms-sheet-drag, 0px)); }
.cms-sheet--ready { transition: transform 240ms cubic-bezier(.2,.7,.2,1); }
.cms-sheet--drag { transition: none; }
/* A tablet: not edge to edge, the width of a column. */
@media (min-width: 768px) { .cms-sheet { max-width: 40rem; } }
@media (prefers-reduced-motion: reduce) { .cms-sheet--ready { transition: none; } }

.cms-sheet__handle {
  position: relative; flex: none; display: flex; align-items: center; gap: 0.625rem; width: 100%;
  height: var(--cms-handle); padding: 0.5rem 0.875rem env(safe-area-inset-bottom, 0px); text-align: left;
  background: var(--ui-bg); border-radius: 1.125rem 1.125rem 0 0; touch-action: none; user-select: none;
}
.cms-sheet__handle:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: -2px; }
.cms-sheet__grab { position: absolute; left: 50%; top: 0.375rem; width: 2.25rem; height: 0.25rem; margin-left: -1.125rem; border-radius: 2px; background: var(--ui-border-accented, var(--ui-border)); }
.cms-sheet__icon { display: grid; place-items: center; flex: none; width: 2.25rem; height: 2.25rem; margin-top: 0.25rem; border-radius: 0.625rem; background: var(--cms-nav-active); color: var(--ui-text-highlighted); }
.cms-sheet__text { display: flex; flex: 1; min-width: 0; flex-direction: column; margin-top: 0.25rem; line-height: 1.25; }
.cms-sheet__text b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--cms-font-display); font-size: 0.875rem; font-weight: 700; color: var(--ui-text-highlighted); }
.cms-sheet__text span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; color: var(--ui-text-muted); }
.cms-sheet__chev { margin-top: 0.25rem; color: var(--ui-text-muted); transition: transform 240ms cubic-bezier(.2,.7,.2,1); }
.cms-sheet--open .cms-sheet__chev { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .cms-sheet__chev { transition: none; } }

.cms-sheet__body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0.5rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px)); }
.cms-sheet__rows { display: flex; flex-direction: column; gap: 0.375rem; }
.cms-sheet__row { display: flex; align-items: center; gap: 0.625rem; width: 100%; min-height: 2.75rem; padding: 0.5rem 0.75rem; text-align: left; }
.cms-sheet__row:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: -2px; border-radius: inherit; }
.cms-sheet__name { flex: none; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-highlighted); }
</style>
