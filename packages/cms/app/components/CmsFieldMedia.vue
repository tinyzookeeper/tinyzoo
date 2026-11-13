<script setup lang="ts">
import type { Ref } from 'vue'
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
// Large preview in the content column, compact in the properties panel.
const placement = inject<Ref<'main' | 'sidebar'>>('cmsFieldPlacement', ref('main'))
const compact = computed(() => placement.value === 'sidebar')

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

    <!-- has media → the picture itself, its description, and two quiet actions -->
    <div v-if="media" class="space-y-2">
      <div
        class="group relative overflow-hidden rounded-(--ui-radius) border border-default bg-muted"
        :class="compact ? 'aspect-[1.91/1]' : 'max-h-56'"
      >
        <img
          v-if="isImage" :src="media.url" :alt="media.alt ?? ''"
          :width="media.width || undefined" :height="media.height || undefined"
          loading="lazy" decoding="async" class="block size-full object-cover"
          :class="compact ? '' : 'max-h-56 object-contain mx-auto'"
        >
        <div v-else class="flex items-center gap-2 p-3 text-sm text-muted">
          <UIcon name="i-lucide-file" class="size-5" /> {{ media.mime }}
        </div>
      </div>
      <div class="flex items-center gap-1">
        <UInput
          v-if="isImage" v-model="alt" size="sm" class="flex-1 min-w-0" :aria-label="t('media.altLabel')"
          :placeholder="t('media.altPlaceholder')" @blur="saveAlt" @keydown.enter.prevent="saveAlt"
        />
        <span v-else class="flex-1" />
        <UDropdownMenu
          :items="[[
            { label: t('media.replace'), icon: 'i-lucide-upload', onSelect: pick },
            { label: t('media.browse'), icon: 'i-lucide-images', onSelect: () => { libraryOpen = true } },
          ], [
            { label: t('media.remove'), icon: 'i-lucide-x', color: 'error' as const, onSelect: clear },
          ]]"
          :content="{ align: 'end' }"
        >
          <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-ellipsis" :loading="uploading" :aria-label="t('media.actions')" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- empty → one quiet drop target; the library is a link -->
    <div v-else class="space-y-1.5">
      <button
        type="button"
        class="w-full rounded-(--ui-radius) border border-dashed border-accented flex items-center justify-center gap-2 text-sm text-muted transition-colors hover:border-(--ui-text-dimmed) hover:text-default disabled:opacity-60"
        :class="compact ? 'py-4' : 'py-8'"
        :disabled="uploading" @click="pick"
      >
        <UIcon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-image-plus'" :class="['size-4', uploading && 'animate-spin']" />
        {{ uploading ? t('media.uploading') : t('media.clickToUpload') }}
      </button>
      <button type="button" class="text-xs text-muted hover:text-highlighted underline-offset-2 hover:underline" @click="libraryOpen = true">
        {{ t('media.browse') }}
      </button>
    </div>

    <p v-if="errorMsg" class="mt-1 text-sm text-error">{{ errorMsg }}</p>
  </div>
</template>
