<script setup lang="ts">
// Live preview beside the form: the site's own preview of this entry (the publish
// config's `preview` path with ?preview), at desktop or phone width. It follows the
// typing: the unsaved values go to the server (POST /api/cms/_preview, for this editor's
// ?preview requests only), then the page is told — `{ type: 'cms:preview', entity, id,
// locale, data }` — and refetches its content (plugins/cmsLivePreview.client.ts).
// With the editor in the preview on (NUXT_CMS_BUILDER=on, useCmsBuilder()), the panel also tells the
// page what it needs to draw its tools and passes the page's `cms:builder:*` messages on. Then a
// desktop page is laid out at a desktop width (1280 px, or wider when the panel is) and drawn scaled
// down to fit, so a row is seen as a row; a phone at 390 px. The page is told its scale, so its tools
// keep their size. Undo and redo (the bridge's history) sit in the panel's bar, with Ctrl/⌘ Z.
// Reloaded after every save; the unsaved values are dropped when the editor closes.
import { cmsBuilderFit, isCmsBuilderToAdmin, type CmsBuilderKey, type CmsBuilderToPage } from '../../shared/builder'

const props = defineProps<{ url: string; entity: string; id: string; locale: string | null; data: Record<string, any>; version: string | null; sheet?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t, locale: adminLanguage } = useCmsI18n()
const builder = useCmsBuilder()

const frame = ref<HTMLIFrameElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const width = ref<'desktop' | 'phone'>('desktop')

// ── the scaled page (the editor in the preview only; without it the frame fills the stage as before) ──
const room = ref<{ width: number; height: number } | null>(null)
const fit = computed(() => (builder.value && room.value ? cmsBuilderFit(width.value, room.value.width, room.value.height) : null))
// Between desktop and phone the width animates; a stage that resizes follows at once.
const morphing = ref(false)
let morphTimer: ReturnType<typeof setTimeout> | undefined
watch(width, () => {
  morphing.value = true
  clearTimeout(morphTimer)
  morphTimer = setTimeout(() => { morphing.value = false }, 320)
})
const frameStyle = computed(() => {
  const f = fit.value
  if (!f) return undefined
  return { width: `${f.width}px`, height: `${f.height}px`, transform: f.scale === 1 ? 'none' : `scale(${f.scale})`, maxWidth: 'none' }
})
const boxStyle = computed(() => {
  const f = fit.value
  return f ? { width: `${Math.round(f.width * f.scale)}px` } : undefined
})
const zoom = computed(() => {
  const s = fit.value?.scale
  if (!s) return null
  try {
    return new Intl.NumberFormat(adminLanguage.value, { style: 'percent', maximumFractionDigits: 0 }).format(Math.floor(s * 100 + 1e-6) / 100)
  }
  catch {
    return `${Math.round(s * 100)} %`
  }
})
let sizes: ResizeObserver | null = null
watch(stage, (el) => {
  sizes?.disconnect()
  sizes = null
  if (!el || typeof ResizeObserver === 'undefined') return
  sizes = new ResizeObserver(([entry]) => {
    const box = entry?.contentRect
    if (box) room.value = { width: box.width, height: box.height }
  })
  sizes.observe(el)
}, { flush: 'post' })
watch(() => fit.value?.scale, (scale) => { if (scale && loaded) sendToPage({ type: 'cms:builder:view', scale }) })
const reloads = ref(0)
// A save made a new version: show what is stored now.
watch(() => props.version, () => { reloads.value++ })

const target = computed(() => {
  try {
    return new URL(props.url, location.origin).origin
  }
  catch {
    return location.origin
  }
})
// Ask the site first (same site only): a missing page or an error is explained here
// instead of the browser's empty "refused to connect" frame.
const problem = ref<null | { status: number }>(null)
let probeSeq = 0
async function probe() {
  const my = ++probeSeq
  problem.value = null
  if (target.value !== location.origin) return
  try {
    const res = await fetch(props.url, { credentials: 'same-origin', headers: { accept: 'text/html' } })
    if (my === probeSeq && !res.ok) problem.value = { status: res.status }
  }
  catch { /* offline or blocked: let the frame try */ }
}
watch([() => props.url, reloads], probe)
const path = computed(() => {
  try {
    return new URL(props.url, location.origin).pathname
  }
  catch {
    return props.url
  }
})

let timer: ReturnType<typeof setTimeout> | null = null
let last = ''
let sending: Promise<unknown> = Promise.resolve()
const draftBody = (data: Record<string, any>) => ({ entity: props.entity, id: props.id, locale: props.locale, data })
async function post(force = false) {
  // A plain copy of the field values (reactive proxies cannot be posted).
  const data = JSON.parse(JSON.stringify(props.data ?? {}))
  const json = JSON.stringify(data)
  if (json !== last || force) {
    last = json
    // One at a time, in order: the page must never refetch before its values arrived.
    sending = sending.then(() => $fetch('/api/cms/_preview', { method: 'POST', body: draftBody(data) }).catch(() => {}))
    await sending
  }
  frame.value?.contentWindow?.postMessage({ type: 'cms:preview', entity: props.entity, id: props.id, locale: props.locale, data }, target.value)
}
watch(() => props.data, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => post(), 250)
}, { deep: true })

// ── the editor in the preview ──
// `builder` is null until the switch is known to be on (then it stays the bridge).
function sendToPage(message: CmsBuilderToPage) {
  frame.value?.contentWindow?.postMessage(message, target.value)
}
function sendOn() {
  const bridge = builder.value
  if (!bridge) return
  sendToPage({
    type: 'cms:builder:on',
    labels: bridge.labels.value,
    texts: {
      drag: t('blocks.drag'), moveUp: t('blocks.moveUp'), moveDown: t('blocks.moveDown'),
      duplicate: t('blocks.duplicate'), remove: t('blocks.remove'), insertHere: t('blocks.insertHere'),
      moveLeft: t('blocks.moveLeft'), moveRight: t('blocks.moveRight'), addBlock: t('blocks.pickerTitle'), blank: t('builderPanel.blank'),
    },
    selected: bridge.selected.value,
    selectedPath: bridge.selectedPath.value,
    lists: JSON.parse(JSON.stringify(bridge.kinds.value)),
    ...(fit.value ? { scale: fit.value.scale } : {}),
  })
}
/** Ctrl/⌘ Z and Ctrl/⌘ ⇧ Z (or Ctrl Y), outside a text field (which keeps the browser's own undo). */
function historyKey(e: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.defaultPrevented) return null
  const key = e.key.toLowerCase()
  const action = key === 'z' ? (e.shiftKey ? 'redo' : 'undo') : key === 'y' && e.ctrlKey && !e.metaKey ? 'redo' : null
  if (!action) return null
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"]')) return null
  return action
}
function onHistoryKey(e: KeyboardEvent) {
  const action = historyKey(e)
  const bridge = builder.value
  if (!action || !bridge) return
  e.preventDefault()
  bridge.history[action]()
}
/**
 * Escape and Alt with an arrow, pressed in the admin while a block is selected, go to the page as if
 * pressed there (the page has no focus after a block was selected from the form). Never from a field
 * someone types in, a menu or a dialog: those keep their keys.
 */
function forwardKey(e: KeyboardEvent) {
  const bridge = builder.value
  if (!bridge?.selectedPath.value || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return
  const arrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight'
  if (!(e.key === 'Escape' && !e.altKey) && !(arrow && e.altKey)) return
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="radiogroup"], [data-cms-no-builder-keys]')) return
  e.preventDefault()
  sendToPage({ type: 'cms:builder:key', key: e.key as CmsBuilderKey })
}
/** The frame has loaded: the draft first, then the tool (the page may load its overlay after the draft). */
let loaded = false
async function onLoad() {
  await post()
  loaded = true
  sendOn()
}
watch(reloads, () => { loaded = false })
// The admin's first render comes from the server, so the frame can finish loading before the
// `load` listener exists: a frame on the same site that is complete counts as loaded.
function frameComplete() {
  try {
    return frame.value?.contentDocument?.readyState === 'complete'
  }
  catch {
    return false
  }
}
watch(builder, (bridge, _old, onCleanup) => {
  if (!bridge || !import.meta.client) return
  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.value?.contentWindow || e.origin !== target.value || !isCmsBuilderToAdmin(e.data)) return
    if (e.data.type === 'cms:builder:ready') sendOn()
    else if (e.data.type === 'cms:builder:history') bridge.history[e.data.action]()
    else bridge.fromPage(e.data)
  }
  const detach = bridge.attach({
    send: sendToPage,
    postNow: () => {
      if (timer) clearTimeout(timer)
      void post()
    },
  })
  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', forwardKey)
  window.addEventListener('keydown', onHistoryKey)
  // The bridge came after the frame loaded: tell the page now.
  if (loaded || frameComplete()) sendOn()
  const stop = watch([bridge.kinds, adminLanguage], () => sendOn(), { deep: true })
  onCleanup(() => {
    stop()
    detach()
    window.removeEventListener('message', onMessage)
    window.removeEventListener('keydown', forwardKey)
    window.removeEventListener('keydown', onHistoryKey)
  })
}, { immediate: true })
onMounted(() => { if (frameComplete()) sendOn() })
// Closed or left: forget the unsaved values, so a later preview shows what is saved.
function clearDraft() {
  try {
    fetch('/api/cms/_preview', {
      method: 'POST', keepalive: true, credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity: props.entity, id: props.id, locale: props.locale, clear: true }),
    }).catch(() => {})
  }
  catch { /* leaving anyway */ }
}
onMounted(() => {
  void probe()
  void post(true)
  // Leaving the page altogether (reload, another address) skips unmounting.
  window.addEventListener('pagehide', clearDraft)
})
onBeforeUnmount(() => {
  sizes?.disconnect()
  clearTimeout(morphTimer)
  if (timer) clearTimeout(timer)
  window.removeEventListener('pagehide', clearDraft)
  clearDraft()
})
</script>

<template>
  <section class="cms-preview" :class="sheet ? 'cms-preview--sheet flex-1 min-h-0' : ''" :aria-label="t('editor.previewPanel')">
    <div class="flex items-center justify-between gap-2 pb-2">
      <div class="flex items-center gap-1">
        <span class="text-xs text-muted mr-2 max-sm:hidden">{{ t('editor.previewHint') }}</span>
        <UButton
          size="xs" variant="ghost" :color="width === 'desktop' ? 'primary' : 'neutral'" icon="i-lucide-monitor"
          :aria-label="t('editor.previewDesktop')" :aria-pressed="width === 'desktop'" @click="() => { width = 'desktop' }"
        />
        <UButton
          size="xs" variant="ghost" :color="width === 'phone' ? 'primary' : 'neutral'" icon="i-lucide-smartphone"
          :aria-label="t('editor.previewPhone')" :aria-pressed="width === 'phone'" @click="() => { width = 'phone' }"
        />
        <template v-if="builder">
          <span class="mx-1 h-4 w-px bg-(--ui-border)" aria-hidden="true" />
          <UTooltip :text="`${t('editor.previewUndo')} (Ctrl/⌘ Z)`">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-undo-2" :aria-label="t('editor.previewUndo')" :disabled="!builder.history.canUndo.value" @click="builder.history.undo()" />
          </UTooltip>
          <UTooltip :text="`${t('editor.previewRedo')} (Ctrl/⌘ ⇧ Z)`">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-redo-2" :aria-label="t('editor.previewRedo')" :disabled="!builder.history.canRedo.value" @click="builder.history.redo()" />
          </UTooltip>
        </template>
      </div>
      <div class="flex items-center gap-1">
        <span v-if="zoom" class="mr-1 text-xs text-muted tabular-nums" :title="t('editor.previewScale', { percent: zoom })">{{ zoom }}</span>
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-rotate-cw" :aria-label="t('editor.previewReload')" @click="() => { reloads++ }" />
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-external-link" :to="url" target="_blank" :aria-label="t('editor.preview')" />
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="t('common.close')" @click="emit('close')" />
      </div>
    </div>
    <div v-if="problem" class="cms-preview__stage grid place-items-center p-6">
      <div class="max-w-sm text-center">
        <UIcon :name="problem.status === 404 ? 'i-lucide-file-question' : 'i-lucide-triangle-alert'" class="size-8 text-dimmed" />
        <p class="mt-3 text-sm font-medium text-highlighted">{{ problem.status === 404 ? t('editor.previewMissingTitle') : t('editor.previewErrorTitle') }}</p>
        <p class="mt-1 text-sm text-muted text-pretty">
          {{ problem.status === 404 ? t('editor.previewMissingBody', { path }) : t('editor.previewErrorBody', { status: problem.status }) }}
        </p>
        <UButton class="mt-4" size="sm" color="neutral" variant="outline" icon="i-lucide-rotate-cw" @click="() => { reloads++ }">{{ t('editor.previewReload') }}</UButton>
      </div>
    </div>
    <div v-else-if="builder" ref="stage" class="cms-preview__stage cms-preview__stage--fit">
      <div class="cms-preview__box" :class="[width === 'phone' ? 'cms-preview__box--phone' : '', morphing ? 'cms-preview__box--morph' : '']" :style="boxStyle">
        <iframe
          :key="reloads" ref="frame" :src="url" :title="t('editor.previewPanel')"
          class="cms-preview__frame cms-preview__frame--fit" :style="frameStyle" @load="onLoad()"
        />
      </div>
    </div>
    <div v-else class="cms-preview__stage">
      <iframe
        :key="reloads" ref="frame" :src="url" :title="t('editor.previewPanel')"
        class="cms-preview__frame" :class="width === 'phone' ? 'cms-preview__frame--phone' : ''" @load="onLoad()"
      />
    </div>
  </section>
</template>
