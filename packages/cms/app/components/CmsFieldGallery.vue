<script setup lang="ts">
// Gallery field: several files in order, each with an optional caption. Add by
// uploading (several at once) or from the library; drag to reorder (or use the
// arrows); the caption sits under each picture.
const props = defineProps<{ field: any }>()
const model = defineModel<{ mediaId: string; caption?: string | null }[] | null>()
const { t } = useCmsI18n()
const toast = useToast()

const items = computed(() => model.value ?? [])
const media = reactive<Record<string, any>>({})
async function resolve(ids: string[]) {
  const missing = ids.filter((id) => !media[id])
  if (!missing.length) return
  // The media list returns at most 60 at a time.
  for (let i = 0; i < missing.length; i += 60) {
    const ids = missing.slice(i, i + 60)
    const res = await $fetch<{ items: any[] }>('/api/cms/_media', { query: { ids: ids.join(','), limit: 60 } }).catch(() => ({ items: [] }))
    for (const m of res.items) media[m.id] = m
  }
}
watch(() => items.value.map((i) => i.mediaId), (ids) => { void resolve(ids) }, { immediate: true })

const set = (next: { mediaId: string; caption?: string | null }[]) => { model.value = next }
function add(m: any) {
  media[m.id] = m
  if (items.value.some((i) => i.mediaId === m.id)) return
  set([...items.value, { mediaId: m.id, caption: null }])
}
const remove = (i: number) => set(items.value.filter((_, j) => j !== i))
function move(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= items.value.length) return
  const next = [...items.value]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  set(next)
}
const setCaption = (i: number, caption: string) => set(items.value.map((it, j) => (j === i ? { ...it, caption: caption || null } : it)))

const dragFrom = ref<number | null>(null)
function onDragOver(i: number) {
  const from = dragFrom.value
  if (from === null || from === i) return
  const next = [...items.value]
  const [moved] = next.splice(from, 1)
  next.splice(i, 0, moved!)
  set(next)
  dragFrom.value = i
}

const libraryOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(0)
async function upload(files: FileList | null) {
  for (const file of [...(files ?? [])]) {
    uploading.value++
    try {
      const form = new FormData()
      form.append('file', file)
      add(await $fetch('/api/cms/_media', { method: 'POST', body: form }))
    }
    catch (err: any) {
      toast.add({ title: t('media.uploadFailed'), description: `${file.name}: ${cmsRequestError(err, t as any)}`, color: 'error', icon: 'i-lucide-x' })
    }
    finally {
      uploading.value--
    }
  }
}
const isImage = (m: any) => String(m?.mime ?? '').startsWith('image/')
</script>

<template>
  <div class="space-y-3">
    <CmsMediaLibrary v-model:open="libraryOpen" :accept="field.meta?.accept" @select="add" />
    <input ref="fileInput" type="file" multiple class="hidden" :accept="field.meta?.accept" @change="(e: any) => { upload(e.target.files); e.target.value = '' }">
    <ol v-if="items.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <li
        v-for="(it, i) in items" :key="it.mediaId" draggable="true" class="group space-y-1.5"
        :class="dragFrom === i ? 'opacity-60' : ''"
        @dragstart="dragFrom = i" @dragover.prevent="onDragOver(i)" @dragend="dragFrom = null" @drop.prevent="dragFrom = null"
      >
        <div class="relative aspect-[4/3] overflow-hidden rounded-(--ui-radius) border border-default bg-elevated cursor-grab">
          <img v-if="isImage(media[it.mediaId])" :src="media[it.mediaId].url" :alt="media[it.mediaId].alt ?? ''" class="size-full object-cover" loading="lazy">
          <span v-else class="grid size-full place-items-center text-dimmed"><UIcon name="i-lucide-file" class="size-6" /></span>
          <div class="absolute right-1 top-1 flex gap-0.5 rounded-md bg-default/90 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :disabled="i === 0" :aria-label="t('fields.galleryEarlier')" @click="move(i, -1)" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-right" :disabled="i === items.length - 1" :aria-label="t('fields.galleryLater')" @click="move(i, 1)" />
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-x" :aria-label="t('media.remove')" @click="remove(i)" />
          </div>
        </div>
        <UInput
          :model-value="it.caption ?? ''" size="xs" variant="ghost" class="w-full" :placeholder="t('fields.galleryCaption')"
          :aria-label="t('fields.galleryCaption')" @update:model-value="(v: any) => setCaption(i, String(v))"
        />
      </li>
    </ol>
    <div class="flex flex-wrap gap-2">
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-upload" :loading="uploading > 0" @click="fileInput?.click()">{{ t('media.upload') }}</UButton>
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-images" @click="libraryOpen = true">{{ t('media.browse') }}</UButton>
      <span v-if="items.length" class="self-center text-xs text-muted">{{ t('fields.galleryCount', { count: items.length }) }}</span>
    </div>
  </div>
</template>
