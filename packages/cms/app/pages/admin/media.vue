<script setup lang="ts">
// The media library: every uploaded file in a grid, by folder, searchable. Drop files
// anywhere on the page to upload them (into the open folder).
//
// A file opens in a panel docked on the right (?file=… in the address), never over
// the page: the grid stays usable, and clicking another file switches the panel (its
// unsaved changes are saved first). On phones the panel is a page of its own. It holds
// the descriptions (per content language), folder, focal point — click the image where
// it must stay in view when the site crops it — and where the file is used.
definePageMeta({ layout: 'admin' })
const { t, tl, formatNumber, formatDate } = useCmsI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
useHead({ title: () => t('media.libraryTitle') })

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
// A role with `media: 'none'` has no library (the server refuses every call): say so, show nothing to load.
const { data: me } = await useFetch<{ access?: { media?: 'all' | 'own' | 'none' } }>('/api/cms/_auth/me', { key: 'cms-access' })
const closed = computed(() => me.value?.access?.media === 'none')
// Content languages (from any translatable collection): descriptions per language.
const locales = computed(() => (graph.value ?? []).find((e: any) => e.locales)?.locales as { default: string; all: string[]; labels: Record<string, any> } | undefined)
const otherLangs = computed(() => (locales.value?.all ?? []).filter((l) => l !== locales.value?.default))
const langLabel = (code: string) => tl(locales.value?.labels?.[code], code.toUpperCase())

const q = ref('')
const folder = ref<string>('all')
const kind = ref<'all' | 'image/*' | 'video/*' | 'audio/*' | 'application/pdf'>('all')
const limit = 48
const page = ref(1)
const items = ref<any[]>([])
const total = ref(0)
const folders = ref<string[]>([])
const loading = ref(false)
// The empty state only once the first answer is in (never on the page's first paint).
const loaded = ref(false)
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
    toast.add({ title: t('media.loadFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    loading.value = false
    loaded.value = true
  }
}
onMounted(() => { if (!closed.value) load() })
let debounce: ReturnType<typeof setTimeout> | undefined
watch(q, () => { clearTimeout(debounce); debounce = setTimeout(() => load(), 250) })
watch([folder, kind], () => load())
const folderTabs = computed(() => [
  { value: 'all', label: t('media.allFiles') },
  { value: 'none', label: t('media.noFolder') },
  ...folders.value.map((f) => ({ value: f, label: f })),
])

const isImage = (m: any) => cmsMediaKind(m) === 'image'
// A phone has no mouse to drag files with: its empty library says "Upload", not "Drag".
const coarse = ref(false)
onMounted(() => { coarse.value = window.matchMedia('(pointer: coarse)').matches })
const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${formatNumber(Math.round(bytes / 104857.6) / 10)} MB` : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} kB`)

// ── upload: the button, or files dropped on the page ──
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(0)
const dragging = ref(false)
async function upload(files: FileList | File[]) {
  const list = [...files]
  if (!list.length) return
  uploading.value = list.length
  const failures: string[] = []
  let waited = false
  for (const file of list) {
    const form = new FormData()
    form.append('file', file)
    form.append('library', '1')
    if (folder.value !== 'all' && folder.value !== 'none') form.append('folder', folder.value)
    try {
      // Files go one after another; when the server asks for a pause the rest wait for it
      // (one message, not one error per file).
      await cmsUploadFile(form, {
        onWait: () => {
          if (waited) return
          waited = true
          toast.add({ id: 'cms-upload-wait', title: t('media.uploadWaiting'), icon: 'i-lucide-clock', color: 'neutral' })
        },
      })
    }
    catch (err: any) {
      failures.push(`${file.name}: ${cmsRequestError(err, t as any)}`)
    }
    uploading.value--
  }
  // One summary for every file that did not make it (60 wrong files are one message).
  if (failures.length) {
    const shown = failures.slice(0, 3).join('\n')
    toast.add({
      title: failures.length === list.length && list.length === 1 ? t('media.uploadFailed') : t('media.uploadSomeFailed', { count: failures.length }),
      description: failures.length > 3 ? `${shown}\n${t('list.andMore', { count: failures.length - 3 })}` : shown,
      color: 'error', icon: 'i-lucide-x', duration: 10000,
    })
  }
  if (list.length - failures.length) toast.add({ title: t('media.uploaded', { count: list.length - failures.length }), color: 'success', icon: 'i-lucide-check' })
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
const dirty = computed(() => !!current.value && (
  draft.alt !== (current.value.alt ?? '')
  || draft.folder !== (current.value.folder ?? '')
  || JSON.stringify(draft.focal) !== JSON.stringify(current.value.focalX != null ? { x: current.value.focalX, y: current.value.focalY } : null)
  || Object.entries(draft.altLocales).some(([k, v]) => (v ?? '') !== (current.value.altLocales?.[k] ?? ''))
))
/** Open a file in the panel (saving the one open now, when it has changes). */
async function open(m: any) {
  if (current.value?.id === m.id) return
  if (dirty.value) await save(true)
  show(m)
  router.replace({ query: { ...route.query, file: m.id } })
}
function close() {
  if (dirty.value) save(true)
  current.value = null
  const { file: _file, ...rest } = route.query
  router.replace({ query: rest })
}
async function show(m: any) {
  current.value = m
  draft.alt = m.alt ?? ''
  draft.altLocales = { ...(m.altLocales ?? {}) }
  draft.folder = m.folder ?? ''
  draft.focal = m.focalX != null ? { x: m.focalX, y: m.focalY } : null
  usage.value = null
  const found = (await cmsFetch<{ usage: any[] }>(`/api/cms/_media/${m.id}/usage`).catch(() => ({ usage: [] }))).usage
  // Opened another file meanwhile: its usage, not this one's.
  if (current.value?.id === m.id) usage.value = found
}
// A file named in the address opens on arrival (a shared link, a reload).
onMounted(async () => {
  const id = route.query.file
  if (typeof id !== 'string' || !id) return
  const m = await cmsFetch<any>(`/api/cms/_media/${id}`).catch(() => null)
  if (m) show(m)
})
// While a question is open, Esc belongs to the dialog: the shortcut steps aside (it
// would otherwise take the key first and the dialog would never close).
const asking = useCmsConfirmQuestion()
const confirm = useCmsConfirm()
defineShortcuts(computed(() => (asking.value ? {} : { escape: { usingInput: false, handler: () => { if (current.value) close() } } })))

// The panel's width: drag its edge (or use the arrow keys on it); remembered.
const PEEK_MIN = 320
// The library keeps room for a few columns of files and its filters.
const LIST_MIN = 560
const editorEl = ref<HTMLElement | null>(null)
const peekMax = () => Math.max(PEEK_MIN, Math.min(Math.round(window.innerWidth * 0.6), (editorEl.value?.clientWidth ?? window.innerWidth) - LIST_MIN))
const peekMaxNow = ref(720)
const peekWidth = ref(416)
onMounted(() => {
  try {
    const saved = Number(localStorage.getItem('cms-peek-width'))
    if (saved) peekWidth.value = Math.min(Math.max(saved, PEEK_MIN), peekMax())
  }
  catch { /* storage blocked: the default width */ }
  peekMaxNow.value = peekMax()
  // A narrower window: the panel gives way (without forgetting the width chosen).
  window.addEventListener('resize', fitPeek)
})
onBeforeUnmount(() => window.removeEventListener('resize', fitPeek))
function fitPeek() {
  peekMaxNow.value = peekMax()
  if (peekWidth.value > peekMaxNow.value) peekWidth.value = peekMaxNow.value
}
function setPeekWidth(px: number) {
  peekMaxNow.value = peekMax()
  peekWidth.value = Math.round(Math.min(Math.max(px, PEEK_MIN), peekMaxNow.value))
  try {
    localStorage.setItem('cms-peek-width', String(peekWidth.value))
  }
  catch { /* storage blocked: for this visit only */ }
}
function startResize(e: PointerEvent) {
  const startX = e.clientX
  const startW = peekWidth.value
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  document.documentElement.classList.add('cms-resizing')
  const move = (ev: PointerEvent) => setPeekWidth(startW + (startX - ev.clientX))
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    document.documentElement.classList.remove('cms-resizing')
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
}
function resizeByKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') setPeekWidth(peekWidth.value + 32)
  else if (e.key === 'ArrowRight') setPeekWidth(peekWidth.value - 32)
  else return
  e.preventDefault()
}

// Where a file is used, named as the sidebar names the collections.
const collectionLabel = (name: string) => {
  const e = (graph.value ?? []).find((x: any) => x.name === name)
  return e ? (tl(e.labelSingular) || tl(e.label) || name) : name
}

// Phones: the panel replaces the grid (a page of its own); wide screens: side by side.
const wide = ref(true)
onMounted(() => {
  const mq = window.matchMedia('(min-width: 1024px)')
  wide.value = mq.matches
  mq.addEventListener('change', (e) => { wide.value = e.matches })
})
// Messages ("Saved", "Link copied") appear bottom right — where the panel's buttons
// are. While it is open they move beside it (wide) or above its buttons (phones).
watchEffect(() => {
  if (import.meta.server) return
  const root = document.documentElement.style
  if (current.value) root.setProperty('--cms-toast-right', wide.value ? `${peekWidth.value + 16}px` : '1rem')
  else root.removeProperty('--cms-toast-right')
})
onBeforeUnmount(() => document.documentElement.style.removeProperty('--cms-toast-right'))
/** Arrow keys move the focal point (5 %, with Shift 1 %); Enter or Space puts it in the middle; Backspace clears it. */
function focalKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 1 : 5
  const at = draft.focal ?? { x: 50, y: 50 }
  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  if (e.key === 'ArrowLeft') draft.focal = { x: clamp(at.x - step), y: at.y }
  else if (e.key === 'ArrowRight') draft.focal = { x: clamp(at.x + step), y: at.y }
  else if (e.key === 'ArrowUp') draft.focal = { x: at.x, y: clamp(at.y - step) }
  else if (e.key === 'ArrowDown') draft.focal = { x: at.x, y: clamp(at.y + step) }
  else if ((e.key === 'Enter' || e.key === ' ') && !draft.focal) draft.focal = { x: 50, y: 50 }
  else if (e.key === 'Backspace' || e.key === 'Delete') draft.focal = null
  else return
  e.preventDefault()
}
function setFocal(e: MouseEvent) {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  draft.focal = { x: Math.round(((e.clientX - box.left) / box.width) * 100), y: Math.round(((e.clientY - box.top) / box.height) * 100) }
}
async function save(quiet = false) {
  if (!current.value) return
  saving.value = true
  try {
    const url: string = `/api/cms/_media/${current.value.id}`
    const updated = await $fetch<any>(url, {
      method: 'PATCH', body: { alt: draft.alt, altLocales: draft.altLocales, folder: draft.folder, focal: draft.focal, keep: true },
    })
    items.value = items.value.map((m) => (m.id === updated.id ? updated : m))
    if (current.value?.id === updated.id) current.value = updated
    // A new folder gets its tab right away.
    if (updated.folder && !folders.value.includes(updated.folder)) folders.value = [...folders.value, updated.folder].sort((a, b) => a.localeCompare(b))
    // Switching files saves the one left behind: say so, by name, so it is never a surprise.
    toast.add({
      title: quiet ? t('media.autoSaved', { name: updated.name || updated.key?.split('/').pop() || '' }) : t('editor.saved'),
      color: 'success', icon: 'i-lucide-check',
    })
  }
  catch (err: any) {
    toast.add({ title: t('editor.saveFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    saving.value = false
  }
}
async function remove() {
  if (!current.value) return
  const ok = await confirm({
    title: t('media.deleteTitle', { name: current.value.name || current.value.key.split('/').pop() }), description: t('media.deleteConfirm'),
    confirmLabel: t('common.delete'), color: 'error',
  })
  if (!ok || !current.value) return
  deleting.value = true
  try {
    const url: string = `/api/cms/_media/${current.value.id}`
    await $fetch(url, { method: 'DELETE' })
    toast.add({ title: t('list.deleted'), color: 'success', icon: 'i-lucide-check' })
    current.value = null
    const { file: _file, ...rest } = route.query
    router.replace({ query: rest })
    load()
  }
  catch (err: any) {
    // Still used somewhere (it may have been put on a page since this panel loaded): say where.
    if (err?.statusCode === 409) {
      const found = (await cmsFetch<{ usage: any[] }>(`/api/cms/_media/${current.value!.id}/usage`).catch(() => ({ usage: [] }))).usage
      usage.value = found
      toast.add({ ...cmsDeleteFailure({ data: { data: { code: 'in_use', usedBy: found } } }, t as any), color: 'error', icon: 'i-lucide-x' })
    }
    else toast.add({ title: t('list.deleteFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
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
  <CmsPage flush :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('media.libraryTitle') }]">
    <template #actions>
      <input ref="fileInput" type="file" multiple class="hidden" accept="image/*,video/*,audio/*,application/pdf" @change="(e: any) => { upload(e.target.files); e.target.value = '' }">
      <UButton v-if="!closed" icon="i-lucide-upload" :loading="uploading > 0" @click="fileInput?.click()">{{ t('media.upload') }}</UButton>
    </template>

    <CmsEmptyState v-if="closed" plain icon="i-lucide-lock" :title="t('media.closedTitle')" :description="t('media.closedBody')" />
    <div v-else ref="editorEl" class="cms-editor" :class="current ? 'cms-editor--peek' : 'cms-editor--no-aside'" :style="{ '--cms-peek-w': `${peekWidth}px` }">
      <!-- the library: stays usable while a file is open beside it -->
      <div
        v-show="!(current && !wide)" class="cms-editor__main relative"
        @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true"
        @dragleave.self="dragging = false" @drop.prevent="onDrop"
      >
        <header class="mb-6 flex items-baseline gap-3">
          <h1 class="cms-display text-[1.75rem] leading-tight text-highlighted">{{ t('media.libraryTitle') }}</h1>
          <span v-if="total" class="text-2xl font-semibold text-dimmed tabular-nums">{{ formatNumber(total) }}</span>
        </header>
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <UTabs v-model="folder" :items="folderTabs" :content="false" variant="link" size="sm" :ui="{ list: 'border-0 gap-4 flex-wrap', trigger: 'px-0' }" />
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <USelect
              v-model="kind" size="sm" variant="ghost" class="w-36"
              :items="[{ label: t('media.kindAll'), value: 'all' }, { label: t('media.kindImages'), value: 'image/*' }, { label: t('media.kindVideo'), value: 'video/*' }, { label: t('media.kindAudio'), value: 'audio/*' }, { label: t('media.kindPdf'), value: 'application/pdf' }]"
              :aria-label="t('media.kindAll')"
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

        <ul v-if="!loaded" class="cms-media-grid" aria-busy="true">
          <li v-for="n in 8" :key="n"><USkeleton class="aspect-square w-full rounded-(--ui-radius)" /></li>
        </ul>
        <CmsEmptyState
          v-else-if="!items.length && !loading" icon="i-lucide-images" character="media"
          :variant="q || folder !== 'all' || kind !== 'all' ? 'no-results' : 'first-use'"
          :title="q || folder !== 'all' || kind !== 'all' ? t('media.noMatches') : t('media.empty')"
          :description="q || folder !== 'all' || kind !== 'all' ? t('media.noMatchesHint') : coarse ? t('media.dropTouchHint') : t('media.dropHint')"
        >
          <template v-if="q || folder !== 'all' || kind !== 'all'" #actions>
            <UButton color="neutral" variant="outline" icon="i-lucide-x" @click="q = ''; folder = 'all'; kind = 'all'">{{ t('media.clearFilters') }}</UButton>
          </template>
        </CmsEmptyState>
        <ul v-else class="cms-media-grid">
          <li v-for="m in items" :key="m.id">
            <button
              type="button" class="group block w-full text-left" :aria-label="t('media.openFile', { name: m.name || m.key })"
              :aria-current="current?.id === m.id ? 'true' : undefined" @click="open(m)"
            >
              <span
                class="block aspect-square overflow-hidden rounded-(--ui-radius) border bg-elevated transition-shadow"
                :class="current?.id === m.id ? 'border-transparent ring-2 ring-(--ui-primary) ring-offset-2 ring-offset-(--ui-bg)' : 'border-default'"
              >
                <CmsMediaThumb :media="m" class="transition-transform group-hover:scale-[1.02]" />
              </span>
              <span class="mt-1.5 block truncate text-xs" :class="current?.id === m.id ? 'text-highlighted font-medium' : 'text-default'">{{ m.name || m.key.split('/').pop() }}</span>
              <span class="block truncate text-xs text-dimmed">{{ m.folder || '' }}<template v-if="m.folder && !m.alt"> · </template><template v-if="!m.alt && isImage(m)">{{ t('media.noAlt') }}</template></span>
            </button>
          </li>
        </ul>
        <div v-if="items.length < total" class="mt-6 flex justify-center">
          <UButton color="neutral" variant="outline" :loading="loading" @click="page++; load(false)">{{ t('media.loadMore') }}</UButton>
        </div>
      </div>

      <!-- the open file: docked beside the library, a page of its own on phones -->
      <aside v-if="current" class="cms-editor__aside cms-peek" :aria-label="current.name || t('media.file')">
        <!-- drag to resize; arrow keys too; a double-click resets -->
        <div
          v-if="wide" class="cms-peek__resize" role="separator" aria-orientation="vertical" tabindex="0"
          :aria-label="t('media.resizePanel')" :aria-valuenow="peekWidth" :aria-valuemin="PEEK_MIN" :aria-valuemax="peekMaxNow"
          @pointerdown.prevent="startResize" @keydown="resizeByKey" @dblclick="setPeekWidth(416)"
        />
        <div class="cms-peek__inner">
          <header class="cms-peek__head">
            <UButton
              v-if="!wide" color="neutral" variant="ghost" icon="i-lucide-chevron-left" class="-ml-2" @click="close"
            >{{ t('media.libraryTitle') }}</UButton>
            <h2 v-else class="min-w-0 truncate text-sm font-medium text-highlighted">{{ current.name || t('media.file') }}</h2>
            <div class="flex items-center gap-1 shrink-0">
              <UTooltip :text="t('media.copyUrl')">
                <UButton color="neutral" variant="ghost" icon="i-lucide-link" :aria-label="t('media.copyUrl')" @click="copyUrl" />
              </UTooltip>
              <UTooltip :text="t('media.openOriginal')">
                <UButton :to="current.url" target="_blank" rel="noopener" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" :aria-label="t('media.openOriginal')" />
              </UTooltip>
              <UTooltip v-if="wide" :text="t('common.close')" :kbds="['esc']">
                <UButton color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('common.close')" @click="close" />
              </UTooltip>
            </div>
          </header>

          <div class="cms-peek__body space-y-6">
            <h2 v-if="!wide" class="cms-display text-xl text-highlighted break-words">{{ current.name || t('media.file') }}</h2>
            <div v-if="isImage(current)" class="space-y-1.5">
              <!-- the focal point: click or tap the picture, or focus it and use the arrow keys -->
              <div
                class="relative cursor-crosshair overflow-hidden rounded-(--ui-radius) border border-default bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-primary)"
                role="group" tabindex="0" :aria-label="t('media.focalLabel')" aria-describedby="cms-focal-help"
                @click="setFocal" @keydown="focalKey"
              >
                <img :src="cmsThumbUrl(current, 960)" :alt="current.alt ?? ''" class="block w-full max-h-[22rem] object-contain mx-auto" @error="(e: Event) => cmsThumbFallback(e, current.url)">
                <span
                  v-if="draft.focal" class="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-2 ring-black/40"
                  :style="{ left: `${draft.focal.x}%`, top: `${draft.focal.y}%` }" aria-hidden="true"
                />
              </div>
              <p id="cms-focal-help" class="text-xs text-muted" aria-live="polite">
                {{ draft.focal ? t('media.focalSet', { x: draft.focal.x, y: draft.focal.y }) : t('media.focalHint') }}
                <span class="max-sm:hidden"> {{ t('media.focalKeys') }}</span>
                <UButton v-if="draft.focal" color="neutral" variant="link" size="xs" class="px-1" @click="() => { draft.focal = null }">{{ t('media.focalClear') }}</UButton>
              </p>
            </div>
            <!-- a video or a sound: played right here -->
            <div v-else class="overflow-hidden rounded-(--ui-radius) border border-default bg-elevated">
              <CmsMediaPreview :media="current" />
            </div>

            <section v-if="isImage(current)" class="space-y-4">
              <UFormField :label="locales ? `${t('media.altLabel')} (${langLabel(locales.default)})` : t('media.altLabel')" :help="t('media.altPlaceholder')">
                <UTextarea v-model="draft.alt" :rows="2" autoresize class="w-full" />
              </UFormField>
              <UFormField v-for="code in otherLangs" :key="code" :label="`${t('media.altLabel')} (${langLabel(code)})`">
                <UTextarea v-model="draft.altLocales[code]" :rows="2" autoresize class="w-full" :placeholder="draft.alt" />
              </UFormField>
            </section>
            <UFormField :label="t('media.folder')" :help="t('media.folderHint')">
              <UInput v-model="draft.folder" list="cms-media-folders" icon="i-lucide-folder" class="w-full" />
              <datalist id="cms-media-folders"><option v-for="f in folders" :key="f" :value="f" /></datalist>
            </UFormField>

            <dl class="space-y-2 text-sm border-t border-default pt-5">
              <div class="flex gap-3"><dt class="w-24 shrink-0 text-muted">{{ t('media.type') }}</dt><dd class="min-w-0 truncate">{{ current.mime }}</dd></div>
              <div class="flex gap-3"><dt class="w-24 shrink-0 text-muted">{{ t('media.size') }}</dt><dd class="tabular-nums">{{ sizeLabel(current.size) }}<template v-if="current.width"> · {{ current.width }} × {{ current.height }}</template></dd></div>
              <div class="flex gap-3"><dt class="w-24 shrink-0 text-muted">{{ t('media.uploadedAt') }}</dt><dd>{{ formatDate(current.createdAt) }}</dd></div>
            </dl>

            <section class="border-t border-default pt-5">
              <h3 class="text-sm font-medium text-highlighted mb-2">{{ t('media.usedIn') }}</h3>
              <p v-if="usage === null" class="text-sm text-muted">…</p>
              <p v-else-if="!usage.length" class="text-sm text-muted">{{ t('media.unused') }}</p>
              <ul v-else class="-mx-2">
                <li v-for="u in usage" :key="`${u.entity}:${u.id}:${u.locale ?? ''}`">
                  <NuxtLink :to="`/admin/${u.entity}/${u.id}${u.locale ? `?locale=${u.locale}` : ''}`" class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-elevated/60">
                    <span class="truncate text-highlighted">{{ u.title || t('common.untitled') }}</span>
                    <span class="shrink-0 text-xs text-muted">{{ collectionLabel(u.entity) }}<template v-if="u.locale"> · {{ u.locale.toUpperCase() }}</template></span>
                  </NuxtLink>
                </li>
              </ul>
            </section>
          </div>

          <footer class="cms-peek__foot">
            <UButton
              color="error" variant="ghost" icon="i-lucide-trash-2" :loading="deleting" :disabled="!!usage?.length"
              :title="usage?.length ? t('media.inUse') : undefined" @click="remove"
            >{{ t('common.delete') }}</UButton>
            <div class="flex items-center gap-3">
              <span v-if="dirty" class="text-xs cms-unsaved">{{ t('editor.unsaved') }}</span>
              <UButton :loading="saving" :disabled="!dirty" @click="save()">{{ t('common.save') }}</UButton>
            </div>
          </footer>
        </div>
      </aside>
    </div>
  </CmsPage>
</template>
