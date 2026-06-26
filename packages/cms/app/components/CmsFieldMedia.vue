<script setup lang="ts">
// Media upload widget. `model` is the cms_media id (the FK value the form saves).
const props = defineProps<{ field: any }>()
const model = defineModel<string | null>()

const media = ref<any>(null)
const uploading = ref(false)
const errorMsg = ref('')
const input = ref<HTMLInputElement | null>(null)

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
const filename = computed(() => media.value?.alt || media.value?.key?.split('/').pop() || 'file')
const sizeLabel = computed(() => {
  const b = Number(media.value?.size ?? 0)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
})

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
    errorMsg.value = err?.data?.statusMessage ?? 'Upload failed'
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}

function clear() {
  model.value = null
  media.value = null
}
</script>

<template>
  <div class="w-full">
    <input ref="input" type="file" class="hidden" :accept="field.meta?.accept" @change="onChange">

    <!-- has media → preview card -->
    <div
      v-if="media"
      class="flex items-center gap-3 rounded-lg border border-default bg-elevated/30 p-2"
    >
      <div class="size-16 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
        <img v-if="isImage" :src="media.url" :alt="media.alt ?? ''" class="size-full object-cover">
        <UIcon v-else name="i-lucide-file" class="size-6 text-dimmed" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ filename }}</p>
        <p class="text-xs text-muted">{{ media.mime }} · {{ sizeLabel }}</p>
      </div>
      <div class="flex items-center gap-1">
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-repeat-2" :loading="uploading" @click="pick">
          Replace
        </UButton>
        <UButton size="xs" variant="ghost" color="error" icon="i-lucide-x" :aria-label="'Remove'" @click="clear" />
      </div>
    </div>

    <!-- empty → upload dropzone -->
    <button
      v-else
      type="button"
      class="w-full rounded-lg border border-dashed border-default px-4 py-6 flex flex-col items-center gap-1.5 text-muted transition hover:border-primary hover:bg-elevated/30 disabled:opacity-60"
      :disabled="uploading"
      @click="pick"
    >
      <UIcon
        :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-upload'"
        :class="['size-5', uploading && 'animate-spin']"
      />
      <span class="text-sm">{{ uploading ? 'Uploading…' : 'Click to upload' }}</span>
      <span v-if="field.meta?.accept" class="text-xs text-dimmed">{{ field.meta.accept }}</span>
    </button>

    <p v-if="errorMsg" class="mt-1 text-sm text-error">{{ errorMsg }}</p>
  </div>
</template>
