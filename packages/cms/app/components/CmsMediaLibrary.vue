<script setup lang="ts">
// Reusable media-library picker. Browse/search existing uploads or add a new one,
// then `select` it. Used by the media field widget and the rich-text image tool.
const props = defineProps<{ accept?: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [media: any] }>()
const toast = useToast()
const { t } = useCmsI18n()

const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const limit = 24
const q = ref('')
const loading = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function load(reset = false) {
  loading.value = true
  try {
    const res: any = await $fetch('/api/cms/_media', { query: { q: q.value, page: page.value, limit, accept: props.accept ?? '' } })
    items.value = reset ? res.items : [...items.value, ...res.items]
    total.value = res.total
  } catch (err: any) {
    toast.add({ title: t('media.loadFailed'), description: err?.data?.statusMessage, color: 'error', icon: 'i-lucide-x' })
  } finally {
    loading.value = false
  }
}

watch(open, (o) => { if (o) { page.value = 1; load(true) } })
let debounce: ReturnType<typeof setTimeout>
watch(q, () => { clearTimeout(debounce); debounce = setTimeout(() => { page.value = 1; load(true) }, 250) })

const canLoadMore = computed(() => items.value.length < total.value)
function more() { page.value++; load() }

// Client-side filter by the field's `accept` (e.g. "image/*") so a picker only
// offers compatible assets, while the library itself stays one shared store.
function matches(m: any) {
  if (!props.accept || props.accept === '*') return true
  return props.accept.split(',').some((raw) => {
    const a = raw.trim()
    if (a.endsWith('/*')) return String(m.mime).startsWith(a.slice(0, -1))
    return m.mime === a
  })
}
const visible = computed(() => items.value.filter(matches))
const isImage = (m: any) => String(m?.mime ?? '').startsWith('image/')

function choose(m: any) {
  emit('select', m)
  open.value = false
}

function pick() { fileInput.value?.click() }
async function onUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const rec: any = await $fetch('/api/cms/_media', { method: 'POST', body: fd })
    items.value.unshift(rec)
    choose(rec)
  } catch (err: any) {
    toast.add({ title: t('media.uploadFailed'), description: err?.data?.statusMessage, color: 'error', icon: 'i-lucide-x' })
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('media.libraryTitle')" :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <input ref="fileInput" type="file" class="hidden" :accept="accept" @change="onUpload">

      <div class="flex items-center gap-2 mb-4">
        <UInput v-model="q" icon="i-lucide-search" :placeholder="t('media.searchPlaceholder')" class="flex-1" :loading="loading" />
        <UButton icon="i-lucide-upload" :loading="uploading" @click="pick">{{ t('media.upload') }}</UButton>
      </div>

      <div v-if="!visible.length && !loading" class="py-16 text-center text-muted">
        <UIcon name="i-lucide-image-off" class="size-8 mx-auto mb-2 text-dimmed" />
        <p>{{ q ? t('media.noMatches') : t('media.empty') }}</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[55vh] overflow-y-auto">
        <button
          v-for="m in visible" :key="m.id" type="button"
          class="group text-left rounded-lg border border-default overflow-hidden hover:ring-2 hover:ring-primary/50 transition"
          @click="choose(m)"
        >
          <div class="aspect-square bg-elevated/40 flex items-center justify-center overflow-hidden">
            <img v-if="isImage(m)" :src="m.url" :alt="m.alt ?? ''" loading="lazy" decoding="async" class="size-full object-cover">
            <UIcon v-else name="i-lucide-file" class="size-7 text-dimmed" />
          </div>
          <div class="p-1.5">
            <p class="truncate text-xs font-medium">{{ m.alt || m.key.split('/').pop() }}</p>
            <p class="truncate text-[10px] text-muted">{{ m.mime }}</p>
          </div>
        </button>
      </div>

      <div v-if="canLoadMore" class="mt-4 text-center">
        <UButton variant="outline" color="neutral" size="sm" :loading="loading" @click="more">{{ t('media.loadMore') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
