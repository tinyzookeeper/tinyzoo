<script setup lang="ts">
// Live preview beside the form: the site's own preview of this entry (the publish
// config's `preview` path with ?preview), at desktop or phone width. It follows the
// typing: the unsaved values go to the server (POST /api/cms/_preview, for this editor's
// ?preview requests only), then the page is told — `{ type: 'cms:preview', entity, id,
// locale, data }` — and refetches its content (plugins/cmsLivePreview.client.ts).
// Reloaded after every save; the unsaved values are dropped when the editor closes.
const props = defineProps<{ url: string; entity: string; id: string; locale: string | null; data: Record<string, any>; version: string | null; sheet?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useCmsI18n()

const frame = ref<HTMLIFrameElement | null>(null)
const width = ref<'desktop' | 'phone'>('desktop')
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
      </div>
      <div class="flex items-center gap-1">
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
    <div v-else class="cms-preview__stage">
      <iframe
        :key="reloads" ref="frame" :src="url" :title="t('editor.previewPanel')"
        class="cms-preview__frame" :class="width === 'phone' ? 'cms-preview__frame--phone' : ''" @load="post()"
      />
    </div>
  </section>
</template>
