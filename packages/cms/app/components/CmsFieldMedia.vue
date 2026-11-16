<script setup lang="ts">
import type { Ref } from 'vue'
// Media upload widget. `model` is the cms_media id (the FK value the form saves).
// `variant="cover"`: the entry's main picture at the top of the writing column, wide,
// with "Change photo" on it.
const props = defineProps<{ field: any; entity?: string; variant?: 'cover' }>()
const model = defineModel<string | null>()
const toast = useToast()
const { t } = useCmsI18n()

const media = ref<any>(null)
const triedId = ref<string | null>(null)
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
    media.value = await cmsFetch(`/api/cms/_media/${id}`)
  } catch {
    media.value = null
  } finally {
    triedId.value = id
  }
}
watch(model, resolveMedia, { immediate: true })
// A chosen file whose details have not arrived yet: a placeholder, not "add a photo".
const resolving = computed(() => !!model.value && media.value?.id !== model.value && triedId.value !== model.value && !uploading.value)

const isImage = computed(() => String(media.value?.mime ?? '').startsWith('image/'))
// A document (f.file): its kind and size, the way people talk about files.
const fileKind = computed(() => {
  const m = String(media.value?.mime ?? '')
  return m === 'application/pdf' ? 'PDF' : (m.split('/')[1] ?? m).toUpperCase()
})
const fileSize = computed(() => {
  const n = Number(media.value?.size ?? 0)
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`
})
const isFileField = computed(() => !!props.field?.meta?.file)
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
    toast.add({ title: t('media.altSaveFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
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
    errorMsg.value = cmsRequestError(err, t as any)
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
  <div v-if="variant === 'cover'" class="w-full">
    <input ref="input" type="file" class="hidden" :accept="field.meta?.accept" @change="onChange">
    <CmsMediaLibrary v-model:open="libraryOpen" :accept="field.meta?.accept" @select="onLibrarySelect" />
    <template v-if="media">
      <div class="relative overflow-hidden rounded-xl bg-muted aspect-[2.4/1]">
        <img
          v-if="isImage" :src="media.url" :alt="media.alt ?? ''"
          :width="media.width || undefined" :height="media.height || undefined"
          decoding="async" class="block size-full object-cover"
        >
        <UDropdownMenu
          :items="[[
            { label: t('media.replace'), icon: 'i-lucide-upload', onSelect: pick },
            { label: t('media.browse'), icon: 'i-lucide-images', onSelect: () => { libraryOpen = true } },
          ], [
            { label: t('media.remove'), icon: 'i-lucide-x', color: 'error' as const, onSelect: clear },
          ]]"
          :content="{ align: 'end' }"
        >
          <UButton
            size="sm" color="neutral" variant="outline" icon="i-lucide-image" :loading="uploading"
            class="absolute right-3 bottom-3 bg-default/95 shadow-sm"
          >{{ t('media.changeCover') }}</UButton>
        </UDropdownMenu>
      </div>
      <UInput
        v-if="isImage" v-model="alt" variant="ghost" size="sm" class="mt-1 w-full" :aria-label="t('media.altLabel')"
        :placeholder="t('media.altPlaceholder')" :ui="{ base: 'px-0 text-muted' }" @blur="saveAlt" @keydown.enter.prevent="saveAlt"
      />
    </template>
    <USkeleton v-else-if="resolving" class="w-full aspect-[2.4/1] rounded-xl" />
    <div v-else class="flex flex-col items-start gap-1.5">
      <button
        type="button"
        class="w-full aspect-[4/1] rounded-xl border border-dashed border-accented flex items-center justify-center gap-2 text-sm text-muted transition-colors hover:border-(--ui-text-dimmed) hover:text-default disabled:opacity-60"
        :disabled="uploading" @click="pick"
      >
        <UIcon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-image-plus'" :class="['size-4', uploading && 'animate-spin']" />
        {{ uploading ? t('media.uploading') : t('media.addCover') }}
      </button>
      <button type="button" class="text-xs text-muted hover:text-highlighted underline-offset-2 hover:underline" @click="libraryOpen = true">
        {{ t('media.browse') }}
      </button>
    </div>
    <p v-if="errorMsg" class="mt-1 text-sm text-error">{{ errorMsg }}</p>
  </div>

  <div v-else class="w-full">
    <input ref="input" type="file" class="hidden" :accept="field.meta?.accept" @change="onChange">
    <CmsMediaLibrary v-model:open="libraryOpen" :accept="field.meta?.accept" @select="onLibrarySelect" />

    <!-- has media → the picture itself, its description, and two quiet actions -->
    <div v-if="media" class="space-y-2">
      <div
        class="group relative overflow-hidden rounded-(--ui-radius) border border-default bg-muted"
        :class="!isImage ? '' : compact ? 'aspect-[1.91/1]' : 'max-h-56'"
      >
        <img
          v-if="isImage" :src="media.url" :alt="media.alt ?? ''"
          :width="media.width || undefined" :height="media.height || undefined"
          loading="lazy" decoding="async" class="block size-full object-cover"
          :class="compact ? '' : 'max-h-56 object-contain mx-auto'"
        >
        <a v-else :href="media.url" target="_blank" rel="noopener" class="flex items-center gap-3 p-3 hover:bg-elevated/60">
          <span class="grid size-9 shrink-0 place-items-center rounded-md bg-default border border-default">
            <UIcon :name="media.mime === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-file'" class="size-5 text-muted" />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-highlighted">{{ media.name || media.key?.split('/').pop() }}</span>
            <span class="block text-xs text-muted">{{ fileKind }} · {{ fileSize }}</span>
          </span>
          <UIcon name="i-lucide-arrow-up-right" class="ml-auto size-4 shrink-0 text-dimmed" />
        </a>
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
    <USkeleton v-else-if="resolving" class="w-full rounded-(--ui-radius)" :class="compact ? 'aspect-[1.91/1]' : 'h-40'" />
    <div v-else class="space-y-1.5">
      <button
        type="button"
        class="w-full rounded-(--ui-radius) border border-dashed border-accented flex items-center justify-center gap-2 text-sm text-muted transition-colors hover:border-(--ui-text-dimmed) hover:text-default disabled:opacity-60"
        :class="compact ? 'py-4' : 'py-8'"
        :disabled="uploading" @click="pick"
      >
        <UIcon :name="uploading ? 'i-lucide-loader-circle' : isFileField ? 'i-lucide-file-up' : 'i-lucide-image-plus'" :class="['size-4', uploading && 'animate-spin']" />
        {{ uploading ? t('media.uploading') : isFileField ? t('media.uploadFile') : t('media.clickToUpload') }}
      </button>
      <button type="button" class="text-xs text-muted hover:text-highlighted underline-offset-2 hover:underline" @click="libraryOpen = true">
        {{ t('media.browse') }}
      </button>
    </div>

    <p v-if="errorMsg" class="mt-1 text-sm text-error">{{ errorMsg }}</p>
  </div>
</template>
