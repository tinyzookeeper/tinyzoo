<script setup lang="ts">
// Media upload widget. `model` is the cms_media id (the FK value the form saves).
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<string | null>()
const toast = useToast()
const { t } = useCmsI18n()

const media = ref<any>(null)
const uploading = ref(false)
const errorMsg = ref('')
const input = ref<HTMLInputElement | null>(null)
const libraryOpen = ref(false)

// Resolve the current id -> media record (so the preview survives a page load).
async function resolveMedia(id: string | null | undefined) {
  if (!id) {
    media.value = null
    return
  }
  if (media.value?.id === id) return
  try {
    media.value = await $fetch(`/api/cms/_media/${id}`)
  } catch {
    media.value = null
  }
}
watch(model, resolveMedia, { immediate: true })

const isImage = computed(() => String(media.value?.mime ?? '').startsWith('image/'))
const filename = computed(() => media.value?.key?.split('/').pop() || 'file')
const dims = computed(() =>
  media.value?.width && media.value?.height ? `${media.value.width}×${media.value.height}` : null,
)
const sizeLabel = computed(() => {
  const b = Number(media.value?.size ?? 0)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
})

// Alt text — edit + persist on the media record (accessibility / SEO).
const alt = ref('')
watch(media, (m) => { alt.value = m?.alt ?? '' })
async function saveAlt() {
  if (!media.value) return
  const next = alt.value.trim()
  if (next === (media.value.alt ?? '')) return
  try {
    const url: string = `/api/cms/_media/${media.value.id}`
    const rec: any = await $fetch(url, { method: 'PATCH', body: { alt: next } })
    media.value = rec
  } catch (err: any) {
    toast.add({ title: t('media.altSaveFailed'), description: err?.data?.statusMessage, color: 'error', icon: 'i-lucide-x' })
  }
}

function pick() {
  input.value?.click()
}

async function onChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  errorMsg.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const rec: any = await $fetch('/api/cms/_media', { method: 'POST', body: fd })
    media.value = rec
    model.value = rec.id
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage ?? t('media.uploadFailed')
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}

function onLibrarySelect(rec: any) {
  media.value = rec
  model.value = rec.id
}

function clear() {
  model.value = null
  media.value = null
}
</script>

<template>
  <div class="w-full">
    <input ref="input" type="file" class="hidden" :accept="field.meta?.accept" @change="onChange">
    <CmsMediaLibrary v-model:open="libraryOpen" :accept="field.meta?.accept" @select="onLibrarySelect" />

    <!-- has media → preview card + alt editor -->
    <div v-if="media" class="rounded-lg border border-default bg-elevated/30 p-2 space-y-2">
      <div class="flex items-center gap-3">
        <div class="size-16 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
          <img
            v-if="isImage" :src="media.url" :alt="media.alt ?? ''"
            :width="media.width || undefined" :height="media.height || undefined"
            loading="lazy" decoding="async" class="size-full object-cover"
          >
          <UIcon v-else name="i-lucide-file" class="size-6 text-dimmed" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ filename }}</p>
          <p class="text-xs text-muted">{{ dims ? `${dims} · ` : '' }}{{ media.mime }} · {{ sizeLabel }}</p>
        </div>
        <div class="flex items-center gap-1">
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-images" :aria-label="t('media.browse')" @click="libraryOpen = true" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-repeat-2" :loading="uploading" @click="pick">{{ t('media.replace') }}</UButton>
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-x" :aria-label="t('media.remove')" @click="clear" />
        </div>
      </div>
      <UInput
        v-if="isImage" v-model="alt" size="sm" class="w-full"
        :placeholder="t('media.altPlaceholder')"
        @blur="saveAlt" @keydown.enter.prevent="saveAlt"
      />
    </div>

    <!-- empty → upload dropzone + browse -->
    <div v-else class="flex flex-col gap-2">
      <button
        type="button"
        class="w-full rounded-lg border border-dashed border-default px-4 py-6 flex flex-col items-center gap-1.5 text-muted transition hover:border-primary hover:bg-elevated/30 disabled:opacity-60"
        :disabled="uploading"
        @click="pick"
      >
        <UIcon
          :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-upload'"
          :class="['size-5', uploading && 'animate-spin']"
        />
        <span class="text-sm">{{ uploading ? t('media.uploading') : t('media.clickToUpload') }}</span>
        <span v-if="field.meta?.accept" class="text-xs text-dimmed">{{ field.meta.accept }}</span>
      </button>
      <UButton variant="link" size="xs" icon="i-lucide-images" class="self-center" @click="libraryOpen = true">
        or choose from library
      </UButton>
    </div>

    <p v-if="errorMsg" class="mt-1 text-sm text-error">{{ errorMsg }}</p>
  </div>
</template>
