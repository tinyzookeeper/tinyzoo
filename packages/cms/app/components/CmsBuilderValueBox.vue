<script setup lang="ts">
// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), since 2g: a small box over the preview,
// at an element of the page that shows values of an entry or a global which are not typed as page text: a
// number, a date, a choice, a rich text, a text with a form, or several values the element shows together
// (the "from" and the "to" of one row of the opening hours). It holds those fields' own controls, the same
// components the entry's form uses, bound to the changes that wait in the page's editor (useCmsBuilder
// `pending`): the preview shows a change at once, undo and redo hold it, and the editor's save stores it.
//
// The preview panel places it: `anchor` is the element's box and `bounds` the visible page, both in the
// panel's own pixels. It stands under the element (above it when there is no room, always inside the
// panel), follows it while the page scrolls, and closes when the element leaves the visible page, on
// Escape, on Enter in a field of one line, and on a press elsewhere. The keyboard goes into its first control.
import { cmsEntryFieldAt, cmsPendingRow } from '../../shared/builder-pending'
import { cmsValueAt } from '../../shared/builder-values'

interface Box { left: number; top: number; width: number; height: number }
const props = defineProps<{
  request: { entity: string; id: string; values: string[][]; at: number }
  anchor: Box
  bounds: Box
  room: { width: number; height: number }
}>()
const emit = defineEmits<{ close: [] }>()
const { t, entityLabel } = useCmsI18n()
const builder = useCmsBuilder()
const { data: graph } = useNuxtData<any[]>('cms-graph')

const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === props.request.entity))
const entry = computed(() => builder.value?.pending.entry(props.request.entity, props.request.id) ?? null)
const row = computed(() => (entry.value ? cmsPendingRow(entry.value) : null))
const loading = ref(true)
watch(() => props.request.at, async () => {
  loading.value = true
  await builder.value?.pending.open(props.request.entity, props.request.id)
  loading.value = false
}, { immediate: true })

const bindings = computed(() => {
  const r = row.value
  if (!r) return []
  const fields = (meta.value?.fields ?? []).filter((f: any) => f.key !== meta.value?.orderField)
  return props.request.values.flatMap((at) => {
    const field = cmsEntryFieldAt<any>(fields, r, at)
    return field ? [{ at, key: at.join('.'), field, value: cmsValueAt(r, at) }] : []
  })
})
const rich = computed(() => bindings.value.some((b) => b.field.type === 'richtext'))
const long = computed(() => rich.value || bindings.value.some((b) => b.field.type === 'text' && b.field.meta?.multiline))
/** Two short values of one element stand side by side ("from" and "to"). */
const beside = computed(() => bindings.value.length === 2 && !long.value && bindings.value.every((b) => ['text', 'number', 'select'].includes(b.field.type)))
const heading = computed(() => (entry.value ? builder.value?.pending.title(entry.value) : entityLabel(meta.value)) ?? '')
const locked = computed(() => !!entry.value && !entry.value.can)

// The controls read what a form gives them: the entry's values (a field may read another), no shared text.
provide('cmsForm', { get state() { return row.value ?? {} }, isNew: computed(() => false), issues: {}, quiet: (fn: () => void) => fn() })
provide('cmsCollab', null)
provide('cmsInBuilderPanel', true)
provide('cmsReadOnly', locked)

function set(at: string[], value: unknown) {
  if (locked.value) return
  builder.value?.pending.set(props.request.entity, props.request.id, at, value === undefined ? null : value)
}
function whole() {
  builder.value?.editEntry(props.request.entity, props.request.id, props.request.values[0]?.[0] ?? null)
  emit('close')
}

// ── where it stands ──
const root = ref<HTMLElement | null>(null)
const size = ref<{ width: number; height: number } | null>(null)
let sizes: ResizeObserver | null = null
onMounted(() => {
  if (!root.value || typeof ResizeObserver === 'undefined') return
  sizes = new ResizeObserver(() => { if (root.value) size.value = { width: root.value.offsetWidth, height: root.value.offsetHeight } })
  sizes.observe(root.value)
  size.value = { width: root.value.offsetWidth, height: root.value.offsetHeight }
})
onBeforeUnmount(() => sizes?.disconnect())
const width = computed(() => Math.max(200, Math.min(rich.value ? 544 : beside.value || long.value ? 384 : 304, props.room.width - 16)))
const style = computed(() => {
  const a = props.anchor
  const h = size.value?.height ?? 0
  const gap = 8
  const under = a.top + a.height + gap
  const over = a.top - h - gap
  const fits = (top: number) => top >= 8 && top + h <= props.room.height - 8
  const top = fits(under) ? under : fits(over) ? over : Math.max(8, Math.min(under, props.room.height - h - 8))
  const left = Math.max(8, Math.min(a.left, props.room.width - width.value - 8))
  return { left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, width: `${width.value}px`, visibility: size.value ? 'visible' as const : 'hidden' as const }
})
// The element left the visible page (scrolled away): the box closes; what was changed stays.
watch(() => [props.anchor, props.bounds] as const, ([a, b]) => {
  const out = a.top + a.height < b.top - 4 || a.top > b.top + b.height + 4 || a.left + a.width < b.left - 4 || a.left > b.left + b.width + 4
  if (out) emit('close')
}, { deep: true })

// ── the keyboard and a press elsewhere ──
const FIRST = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), .ProseMirror[contenteditable="true"], button[role="combobox"]:not([disabled]), button[role="switch"]:not([disabled]), [role="radio"]:not([disabled]), button[aria-pressed]:not([disabled])'
let focused = false
watch(() => [bindings.value.length, loading.value] as const, async ([count, busy]) => {
  if (!count || busy || focused || locked.value) return
  focused = true
  await nextTick()
  const first = root.value?.querySelector<HTMLElement>(`.cms-vbox__fields :is(${FIRST})`)
  first?.focus({ preventScroll: true })
  if (first instanceof HTMLInputElement && ['text', 'number', 'email', 'url', 'tel', ''].includes(first.type)) first.select()
}, { immediate: true, flush: 'post' })
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('close')
  }
  // Enter in a field of one line says "done".
  else if (e.key === 'Enter' && !e.isComposing && e.target instanceof HTMLInputElement && !e.defaultPrevented) {
    e.preventDefault()
    emit('close')
  }
}
/** A press outside the box closes it; a control's own list, calendar or dialog (drawn outside it) is part of it. */
function onDown(e: PointerEvent) {
  const target = e.target instanceof Element ? e.target : null
  if (!target || root.value?.contains(target)) return
  if (target.closest('[data-reka-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"], [data-dismissable-layer]')) return
  emit('close')
}
onMounted(() => document.addEventListener('pointerdown', onDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDown, true))
</script>

<template>
  <div
    ref="root" class="cms-vbox" :class="rich ? 'cms-vbox--rich' : ''" role="dialog" :aria-label="heading" :style="style"
    data-cms-value-box data-cms-no-builder-keys @keydown="onKey"
  >
    <header class="cms-vbox__head">
      <span class="cms-vbox__icon"><UIcon :name="meta?.icon ?? (meta?.singleton ? 'i-lucide-settings-2' : 'i-lucide-folder')" class="size-3.5" aria-hidden="true" /></span>
      <div class="min-w-0 flex-1">
        <p class="cms-vbox__title" :title="heading">{{ heading }}</p>
        <p class="cms-vbox__note">{{ t('builderPending.shared') }}</p>
      </div>
      <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="t('common.close')" @click="emit('close')" />
    </header>
    <p v-if="entry?.error" role="alert" class="cms-vbox__error">
      <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />{{ entry.error }}
    </p>
    <p v-if="locked" class="cms-vbox__error cms-vbox__error--quiet" role="status">
      <UIcon name="i-lucide-lock" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />{{ t('builderPending.cannot') }}
    </p>
    <div v-if="bindings.length" class="cms-vbox__fields" :class="beside ? 'cms-vbox__fields--beside' : ''">
      <div v-for="b in bindings" :key="b.key" class="min-w-0">
        <CmsField
          :model-value="b.value" :field="b.field" :entity="request.entity" :id-prefix="`vbox-${request.id}-${b.key}-`" hide-optional
          :placement="b.field.type === 'richtext' ? 'main' : 'sidebar'"
          @update:model-value="(v: unknown) => set(b.at, v)"
        />
      </div>
    </div>
    <p v-else class="cms-vbox__wait" role="status">
      <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
      {{ loading ? t('builderPending.loading') : t('builderPending.gone') }}
    </p>
    <footer class="cms-vbox__foot">
      <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-panel-left-open" @click="whole">{{ t('builderPending.wholeEntry') }}</UButton>
      <UButton size="xs" color="neutral" variant="outline" @click="emit('close')">{{ t('builderPending.done') }}</UButton>
    </footer>
  </div>
</template>

<style scoped>
.cms-vbox {
  position: absolute; z-index: 30; display: flex; flex-direction: column; gap: 0.75rem; max-height: calc(100% - 1rem); padding: 0.75rem;
  border: 1px solid var(--ui-border); border-radius: 0.875rem; background: var(--ui-bg); color: var(--ui-text);
  box-shadow: 0 18px 44px -18px rgb(0 0 0 / 0.38), 0 2px 8px -2px rgb(0 0 0 / 0.12);
  animation: cms-vbox-in 160ms cubic-bezier(.2,.7,.2,1);
}
@keyframes cms-vbox-in { from { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .cms-vbox { animation: none; } }
.cms-vbox__head { display: flex; align-items: flex-start; gap: 0.5rem; }
.cms-vbox__icon { display: grid; place-items: center; flex: none; width: 1.5rem; height: 1.5rem; margin-top: 0.0625rem; border-radius: 0.4375rem; background: var(--cms-moment-bg); color: var(--cms-moment-text); }
.cms-vbox__title { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--cms-font-display); font-size: 0.8125rem; font-weight: 700; line-height: 1.3; color: var(--ui-text-highlighted); }
.cms-vbox__note { margin: 0.0625rem 0 0; font-size: 0.75rem; line-height: 1.35; color: var(--ui-text-muted); text-wrap: pretty; }
.cms-vbox__error { display: flex; align-items: flex-start; gap: 0.375rem; margin: 0; font-size: 0.8125rem; color: var(--ui-error); }
.cms-vbox__error--quiet { color: var(--ui-text-muted); }
.cms-vbox__fields { display: grid; gap: 0.875rem; min-height: 0; overflow-y: auto; padding: 0.125rem; margin: -0.125rem; }
.cms-vbox__fields--beside { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.cms-vbox--rich .cms-vbox__fields { max-height: min(24rem, 55vh); }
.cms-vbox__wait { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 0.8125rem; color: var(--ui-text-muted); }
.cms-vbox__foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
</style>
