<script setup lang="ts">
// Live preview beside the form: the site's own preview of this entry (the publish
// config's `preview` path with ?preview), reloaded after every save, at desktop or
// phone width. While editing, the unsaved values are also posted to the page —
// `{ type: 'cms:preview', entity, id, locale, data }` — so a site can choose to show
// changes as they are typed (see docs: Live preview).
const props = defineProps<{ url: string; entity: string; id: string; locale: string | null; data: Record<string, any>; version: string | null }>()
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
let timer: ReturnType<typeof setTimeout> | null = null
function post() {
  frame.value?.contentWindow?.postMessage({ type: 'cms:preview', entity: props.entity, id: props.id, locale: props.locale, data: toRaw(props.data) }, target.value)
}
watch(() => props.data, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(post, 300)
}, { deep: true })
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<template>
  <section class="cms-preview" :aria-label="t('editor.previewPanel')">
    <div class="flex items-center justify-between gap-2 pb-2">
      <div class="flex items-center gap-1">
        <UButton
          size="xs" variant="ghost" :color="width === 'desktop' ? 'primary' : 'neutral'" icon="i-lucide-monitor"
          :aria-label="t('editor.previewDesktop')" :aria-pressed="width === 'desktop'" @click="width = 'desktop'"
        />
        <UButton
          size="xs" variant="ghost" :color="width === 'phone' ? 'primary' : 'neutral'" icon="i-lucide-smartphone"
          :aria-label="t('editor.previewPhone')" :aria-pressed="width === 'phone'" @click="width = 'phone'"
        />
      </div>
      <div class="flex items-center gap-1">
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-rotate-cw" :aria-label="t('editor.previewReload')" @click="reloads++" />
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-external-link" :to="url" target="_blank" :aria-label="t('editor.preview')" />
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="t('common.close')" @click="emit('close')" />
      </div>
    </div>
    <div class="cms-preview__stage">
      <iframe
        :key="reloads" ref="frame" :src="url" :title="t('editor.previewPanel')"
        class="cms-preview__frame" :class="width === 'phone' ? 'cms-preview__frame--phone' : ''" @load="post"
      />
    </div>
  </section>
</template>
