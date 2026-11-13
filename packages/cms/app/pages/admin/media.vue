<script setup lang="ts">
// The media library: every uploaded file in a grid, by folder, searchable. Drop files
// anywhere on the page to upload them (into the open folder). A file's panel holds
// its descriptions (per content language), folder, focal point — click the image
// where it must stay in view when the site crops it — and where it is used.
definePageMeta({ layout: 'admin' })
const { t, tl, formatNumber, formatDate } = useCmsI18n()
const toast = useToast()
useHead({ title: () => t('media.libraryTitle') })

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
// Content languages (from any translatable collection): descriptions per language.
const locales = computed(() => (graph.value ?? []).find((e: any) => e.locales)?.locales as { default: string; all: string[]; labels: Record<string, any> } | undefined)
const otherLangs = computed(() => (locales.value?.all ?? []).filter((l) => l !== locales.value?.default))
const langLabel = (code: string) => tl(locales.value?.labels?.[code], code.toUpperCase())

const q = ref('')
const folder = ref<string>('all')
const kind = ref<'all' | 'image/*' | 'application/pdf'>('all')
const limit = 48
const page = ref(1)
const items = ref<any[]>([])
const total = ref(0)
const folders = ref<string[]>([])
const loading = ref(false)
async function load(reset = true) {
  loading.value = true
  if (reset) page.value = 1
  try {
    const res: any = await $fetch('/api/cms/_media', { query: { q: q.value || undefined, folder: folder.value === 'all' ? undefined : folder.value, accept: kind.value === 'all' ? undefined : kind.value, page: page.value, limit } })
    items.value = reset ? res.items : [...items.value, ...res.items]
    total.value = res.total
    folders.value = res.folders ?? []
  }
  catch (err: any) {
    toast.add({ title: t('media.loadFailed'), description: err?.data?.statusMessage, color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    loading.value = false
  }
}
onMounted(() => load())
let debounce: ReturnType<typeof setTimeout> | undefined
watch(q, () => { clearTimeout(debounce); debounce = setTimeout(() => load(), 250) })
watch([folder, kind], () => load())
const folderTabs = computed(() => [
  { value: 'all', label: t('media.allFiles') },
  { value: 'none', label: t('media.noFolder') },
  ...folders.value.map((f) => ({ value: f, label: f })),
])

const isImage = (m: any) => String(m?.mime ?? '').startsWith('image/')
const focalStyle = (m: any) => (m?.focalX != null ? { objectPosition: `${m.focalX}% ${m.focalY}%` } : {})
const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${formatNumber(Math.round(bytes / 104857.6) / 10)} MB` : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} kB`)

// ── upload: the button, or files dropped on the page ──
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(0)
const dragging = ref(false)
async function upload(files: FileList | File[]) {
  const list = [...files]
  if (!list.length) return
  uploading.value = list.length
  let failed = 0
  for (const file of list) {
    const form = new FormData()
    form.append('file', file)
    if (folder.value !== 'all' && folder.value !== 'none') form.append('folder', folder.value)
    try {
      await $fetch('/api/cms/_media', { method: 'POST', body: form })
    }
    catch (err: any) {
      failed++
      toast.add({ title: t('media.uploadFailed'), description: `${file.name}: ${err?.data?.statusMessage ?? ''}`, color: 'error', icon: 'i-lucide-x' })
    }
    uploading.value--
  }
  if (list.length - failed) toast.add({ title: t('media.uploaded', { count: list.length - failed }), color: 'success', icon: 'i-lucide-check' })
  load()
}
function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files)
}

// ── a file's panel ──
const current = ref<any | null>(null)
const draft = reactive<{ alt: string; altLocales: Record<string, string>; folder: string; focal: { x: number; y: number } | null }>({ alt: '', altLocales: {}, folder: '', focal: null })
const usage = ref<any[] | null>(null)
const saving = ref(false)
const deleting = ref(false)
async function open(m: any) {
  current.value = m
  draft.alt = m.alt ?? ''
  draft.altLocales = { ...(m.altLocales ?? {}) }
  draft.folder = m.folder ?? ''
  draft.focal = m.focalX != null ? { x: m.focalX, y: m.focalY } : null
  usage.value = null
  usage.value = (await $fetch<{ usage: any[] }>(`/api/cms/_media/${m.id}/usage`).catch(() => ({ usage: [] }))).usage
}
const panelOpen = computed({ get: () => !!current.value, set: (v: boolean) => { if (!v) current.value = null } })
function setFocal(e: MouseEvent) {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  draft.focal = { x: Math.round(((e.clientX - box.left) / box.width) * 100), y: Math.round(((e.clientY - box.top) / box.height) * 100) }
}
async function save() {
  if (!current.value) return
  saving.value = true
  try {
    const url: string = `/api/cms/_media/${current.value.id}`
    const updated = await $fetch<any>(url, {
      method: 'PATCH', body: { alt: draft.alt, altLocales: draft.altLocales, folder: draft.folder, focal: draft.focal },
    })
    items.value = items.value.map((m) => (m.id === updated.id ? updated : m))
    current.value = updated
    toast.add({ title: t('editor.saved'), color: 'success', icon: 'i-lucide-check' })
    load(false)
  }
  catch (err: any) {
    toast.add({ title: t('editor.saveFailed'), description: err?.data?.statusMessage, color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    saving.value = false
  }
}
async function remove() {
  if (!current.value || !window.confirm(t('media.deleteConfirm'))) return
  deleting.value = true
  try {
    const url: string = `/api/cms/_media/${current.value.id}`
    await $fetch(url, { method: 'DELETE' })
    toast.add({ title: t('list.deleted'), color: 'success', icon: 'i-lucide-check' })
    current.value = null
    load()
  }
  catch (err: any) {
    toast.add({ title: t('list.deleteFailed'), description: err?.data?.statusMessage, color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    deleting.value = false
  }
}
async function copyUrl() {
  try {
    await navigator.clipboard.writeText(new URL(current.value.url, location.origin).toString())
    toast.add({ title: t('media.urlCopied'), color: 'success', icon: 'i-lucide-check' })
  }
  catch { /* clipboard blocked */ }
}
</script>

<template>
  <CmsPage :title="t('media.libraryTitle')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('media.libraryTitle') }]">
    <template #badge>
      <span v-if="total" class="text-2xl font-semibold text-dimmed tabular-nums">{{ formatNumber(total) }}</span>
    </template>
    <template #actions>
      <input ref="fileInput" type="file" multiple class="hidden" accept="image/*,video/*,audio/*,application/pdf" @change="(e: any) => { upload(e.target.files); e.target.value = '' }">
      <UButton icon="i-lucide-upload" :loading="uploading > 0" @click="fileInput?.click()">{{ t('media.upload') }}</UButton>
    </template>

    <div
      class="relative" @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true"
      @dragleave.self="dragging = false" @drop.prevent="onDrop"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <UTabs v-model="folder" :items="folderTabs" :content="false" variant="link" size="sm" :ui="{ list: 'border-0 gap-4 flex-wrap', trigger: 'px-0' }" />
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <USelect
            v-model="kind" size="sm" variant="ghost" class="w-36"
            :items="[{ label: t('media.kindAll'), value: 'all' }, { label: t('media.kindImages'), value: 'image/*' }, { label: t('media.kindPdf'), value: 'application/pdf' }]"
          />
          <UInput v-model="q" icon="i-lucide-search" size="sm" variant="ghost" class="w-full sm:w-56" :placeholder="t('media.searchPlaceholder')" :aria-label="t('media.searchPlaceholder')" />
        </div>
      </div>

      <div
        v-if="dragging" class="absolute inset-0 z-20 grid place-items-center rounded-(--ui-radius) border-2 border-dashed border-primary bg-default/85"
        aria-hidden="true"
      >
        <p class="text-sm font-medium text-highlighted">{{ t('media.dropHere') }}</p>
      </div>

      <CmsEmptyState
        v-if="!items.length && !loading" icon="i-lucide-images"
        :title="q || folder !== 'all' || kind !== 'all' ? t('media.noMatches') : t('media.empty')" :description="t('media.dropHint')"
      />
      <ul v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        <li v-for="m in items" :key="m.id">
          <button type="button" class="group block w-full text-left" :aria-label="t('media.openFile', { name: m.name || m.key })" @click="open(m)">
            <span class="block aspect-square overflow-hidden rounded-(--ui-radius) border border-default bg-elevated">
              <img v-if="isImage(m)" :src="m.url" :alt="m.alt ?? ''" loading="lazy" decoding="async" class="size-full object-cover transition-transform group-hover:scale-[1.02]" :style="focalStyle(m)">
              <span v-else class="grid size-full place-items-center text-dimmed"><UIcon name="i-lucide-file" class="size-8" /></span>
            </span>
            <span class="mt-1.5 block truncate text-xs text-default">{{ m.name || m.key.split('/').pop() }}</span>
            <span class="block truncate text-xs text-dimmed">{{ m.folder || '' }}<template v-if="m.folder && !m.alt"> · </template><template v-if="!m.alt && isImage(m)">{{ t('media.noAlt') }}</template></span>
          </button>
        </li>
      </ul>
      <div v-if="items.length < total" class="mt-6 flex justify-center">
        <UButton color="neutral" variant="outline" :loading="loading" @click="page++; load(false)">{{ t('media.loadMore') }}</UButton>
      </div>
    </div>

    <USlideover v-model:open="panelOpen" :title="current?.name || t('media.file')" :ui="{ content: 'max-w-xl' }">
      <template #body>
        <div v-if="current" class="space-y-6">
          <div v-if="isImage(current)" class="space-y-1.5">
            <div class="relative cursor-crosshair overflow-hidden rounded-(--ui-radius) border border-default bg-elevated" @click="setFocal">
              <img :src="current.url" :alt="current.alt ?? ''" class="block w-full">
              <span
                v-if="draft.focal" class="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-2 ring-black/40"
                :style="{ left: `${draft.focal.x}%`, top: `${draft.focal.y}%` }"
              />
            </div>
            <p class="text-xs text-muted">
              {{ draft.focal ? t('media.focalSet', { x: draft.focal.x, y: draft.focal.y }) : t('media.focalHint') }}
              <UButton v-if="draft.focal" color="neutral" variant="link" size="xs" class="px-1" @click="draft.focal = null">{{ t('media.focalClear') }}</UButton>
            </p>
          </div>

          <UFormField v-if="isImage(current)" :label="locales ? `${t('media.altLabel')} (${langLabel(locales.default)})` : t('media.altLabel')" :help="t('media.altPlaceholder')">
            <UTextarea v-model="draft.alt" :rows="2" autoresize class="w-full" />
          </UFormField>
          <UFormField v-for="code in (isImage(current) ? otherLangs : [])" :key="code" :label="`${t('media.altLabel')} (${langLabel(code)})`">
            <UTextarea v-model="draft.altLocales[code]" :rows="2" autoresize class="w-full" :placeholder="draft.alt" />
          </UFormField>
          <UFormField :label="t('media.folder')" :help="t('media.folderHint')">
            <UInput v-model="draft.folder" list="cms-media-folders" class="w-full" />
            <datalist id="cms-media-folders"><option v-for="f in folders" :key="f" :value="f" /></datalist>
          </UFormField>

          <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt class="text-muted">{{ t('media.type') }}</dt><dd>{{ current.mime }}</dd>
            <dt class="text-muted">{{ t('media.size') }}</dt><dd class="tabular-nums">{{ sizeLabel(current.size) }}<template v-if="current.width"> · {{ current.width }} × {{ current.height }}</template></dd>
            <dt class="text-muted">{{ t('media.uploadedAt') }}</dt><dd>{{ formatDate(current.createdAt) }}</dd>
          </dl>
          <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-link" @click="copyUrl">{{ t('media.copyUrl') }}</UButton>

          <section>
            <h3 class="text-xs font-medium text-muted mb-2">{{ t('media.usedIn') }}</h3>
            <p v-if="usage === null" class="text-sm text-muted">…</p>
            <p v-else-if="!usage.length" class="text-sm text-muted">{{ t('media.unused') }}</p>
            <ul v-else class="-mx-2">
              <li v-for="u in usage" :key="`${u.entity}:${u.id}:${u.locale ?? ''}`">
                <NuxtLink :to="`/admin/${u.entity}/${u.id}${u.locale ? `?locale=${u.locale}` : ''}`" class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-elevated/60">
                  <span class="truncate text-highlighted">{{ u.title || t('common.untitled') }}</span>
                  <span class="text-xs text-muted">{{ u.entity }}<template v-if="u.locale"> · {{ u.locale.toUpperCase() }}</template></span>
                </NuxtLink>
              </li>
            </ul>
          </section>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-between gap-2">
          <UButton
            color="error" variant="ghost" icon="i-lucide-trash-2" :loading="deleting" :disabled="!!usage?.length"
            :title="usage?.length ? t('media.inUse') : undefined" @click="remove"
          >{{ t('common.delete') }}</UButton>
          <UButton icon="i-lucide-check" :loading="saving" @click="save">{{ t('common.save') }}</UButton>
        </div>
      </template>
    </USlideover>
  </CmsPage>
</template>
