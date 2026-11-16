<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Collection list. Quiet by design: the count sits next to the title, status tabs,
// filters and search share one bare row, the title cell carries the thumbnail and
// URL, the whole row opens the entry, and the rest lives behind one "…" menu.
// Search, filters, sort and page live in the address, so a list can be reloaded,
// shared or returned to as it was. Selecting rows offers bulk actions; collections
// with a manual order can be arranged by dragging.
definePageMeta({ layout: 'admin', key: (route) => route.path })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t, tl, entityLabel, entitySingular, fieldLabel, formatNumber, formatDateWith } = useCmsI18n()
const entity = computed(() => route.params.entity as string)

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const fieldOf = (key: string) => meta.value?.fields.find((f: any) => f.key === key)
const title = computed(() => entityLabel(meta.value) || entity.value)
useHead({ title })
const publish = computed(() => meta.value?.publish)
const orderField = computed(() => (meta.value?.orderField as string | null) ?? null)

// ── how this list looks (from the content, or admin.list.layout) ──
// table: rows · grid: picture cards (logos, albums) · dated: Upcoming / Past by date ·
// tree: pages under pages (CmsTreeList brings its own data, search and arranging)
const layout = computed<'table' | 'grid' | 'dated' | 'tree'>(() => meta.value?.listLayout ?? 'table')
const listColumns = computed<string[]>(() => meta.value?.listColumns ?? [])
const dateKey = computed(() => (layout.value === 'dated' ? listColumns.value.find((k) => fieldOf(k)?.type === 'datetime') : undefined))

// ── the list's state, from and to the address ──
const qs = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const limit = 20
const page = ref(Math.max(1, Number(qs('page')) || 1))
const q = ref(qs('q'))
const status = ref<'all' | 'published' | 'scheduled' | 'draft'>((['published', 'scheduled', 'draft'].includes(qs('status')) ? qs('status') : 'all') as any)
// Dated lists: what is coming (from today on, soonest first) or what has been.
const when = ref<'upcoming' | 'past'>(qs('when') === 'past' ? 'past' : 'upcoming')
const defaultSort = computed(() => dateKey.value ?? orderField.value ?? 'updatedAt')
const defaultDir = computed<'asc' | 'desc'>(() => (dateKey.value ? (when.value === 'past' ? 'desc' : 'asc') : orderField.value ? 'asc' : 'desc'))
const sort = ref(qs('sort') || defaultSort.value)
const dir = ref<'asc' | 'desc'>(qs('dir') === 'asc' || qs('dir') === 'desc' ? (qs('dir') as any) : defaultDir.value)
const filters = ref<Record<string, string>>(Object.fromEntries(Object.entries(route.query).filter(([k, v]) => k.startsWith('filter.') && typeof v === 'string')) as Record<string, string>)
watch([q, entity, status, filters], () => { page.value = 1 })
watch(when, () => {
  page.value = 1
  sort.value = defaultSort.value
  dir.value = defaultDir.value
})
// Today, as a date: the same on the server and in the browser all day long.
const today = new Date().toISOString().slice(0, 10)
const dateRange = computed<Record<string, string>>(() => (dateKey.value
  ? { [`filter.${dateKey.value}.${when.value === 'past' ? 'to' : 'from'}`]: today }
  : {}))

const listQuery = computed(() => ({
  page: page.value, q: q.value || undefined, sort: sort.value, dir: dir.value, limit,
  status: status.value === 'all' ? undefined : status.value, ...filters.value, ...dateRange.value,
}))
let urlTimer: ReturnType<typeof setTimeout> | null = null
watch(listQuery, (lq) => {
  if (urlTimer) clearTimeout(urlTimer)
  urlTimer = setTimeout(() => {
    const query: Record<string, string> = {}
    if (lq.page > 1) query.page = String(lq.page)
    if (lq.q) query.q = lq.q
    if (lq.status) query.status = lq.status
    if (dateKey.value && when.value === 'past') query.when = 'past'
    if (sort.value !== defaultSort.value) query.sort = sort.value
    if (dir.value !== (sort.value === defaultSort.value ? defaultDir.value : 'desc')) query.dir = dir.value
    Object.assign(query, filters.value)
    router.replace({ query })
  }, 300)
})

const { data, refresh, status: fetchStatus, error } = await useFetch<{ rows: Record<string, any>[]; total: number }>((): string => `/api/cms/${entity.value}`, {
  query: listQuery,
  watch: [entity],
})
// Someone else created, changed or deleted something here: refresh (a burst of
// changes, e.g. a bulk edit, refreshes once).
let liveRefresh: ReturnType<typeof setTimeout> | null = null
useCmsLiveTopic(`list:${entity.value}`, () => {
  liveRefresh ??= setTimeout(() => {
    liveRefresh = null
    if (!arranging.value) refreshAll()
  }, 400)
})
onBeforeUnmount(() => {
  if (liveRefresh) clearTimeout(liveRefresh)
  if (urlTimer) clearTimeout(urlTimer)
})
// "In progress": drafts and scheduled entries, above the list — what people come
// back for. Shown on the unfiltered first page of collections with drafts.
type Rows = { rows: Record<string, any>[]; total: number }
const progressQuery = (s: 'draft' | 'scheduled') => ({ status: s, limit: 4, sort: 'updatedAt', dir: 'desc' })
const draftsFetch = publish.value ? await useFetch<Rows>((): string => `/api/cms/${entity.value}`, { query: progressQuery('draft'), key: `cms-progress-draft:${entity.value}` }) : null
const scheduledFetch = publish.value?.dateField ? await useFetch<Rows>((): string => `/api/cms/${entity.value}`, { query: progressQuery('scheduled'), key: `cms-progress-scheduled:${entity.value}` }) : null
const inProgress = computed(() => [
  ...(draftsFetch?.data.value?.rows ?? []).map((row) => ({ row, kind: 'draft' as const })),
  ...(scheduledFetch?.data.value?.rows ?? []).map((row) => ({ row, kind: 'scheduled' as const })),
].slice(0, 4))
const showProgress = computed(() => inProgress.value.length > 0 && status.value === 'all' && !q.value && !Object.keys(filters.value).length && page.value === 1)
function refreshAll() {
  refresh()
  draftsFetch?.refresh()
  scheduledFetch?.refresh()
}

const rows = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.total ?? 0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
// Form submissions come from visitors: nothing to create here.
const canCreate = computed(() => meta.value?.can?.create !== false && meta.value?.preset !== 'form')
const canDelete = computed(() => meta.value?.can?.delete !== false)
const canPublish = computed(() => !!publish.value && meta.value?.can?.publish !== false)
const narrowed = computed(() => !!q.value || status.value !== 'all' || Object.keys(filters.value).length > 0)

// ── filters: by field type (the publish status has its tabs) ──
const filterable = computed(() => (meta.value?.fields ?? []).filter((f: any) =>
  f.key !== publish.value?.field && f.key !== orderField.value
  && (['select', 'boolean', 'media', 'datetime'].includes(f.type) || f.relation?.kind === 'many-to-one' || f.relation?.kind === 'many-to-many')
  // A picture in the details panel (the sharing image) is not what people look for.
  && !(f.type === 'media' && f.meta?.position === 'sidebar')))

// ── columns (which ones show is remembered per collection, in this browser) ──
const titleKey = computed(() => meta.value?.titleField as string)
const configured = listColumns
const thumbKey = computed(() => configured.value.find((k) => fieldOf(k)?.type === 'media'))
const slugKey = computed(() => (meta.value?.fields ?? []).find((f: any) => f.type === 'slug')?.key as string | undefined)
const optionalCols = computed(() => configured.value.filter((k) => k !== titleKey.value && k !== thumbKey.value && k !== slugKey.value && k !== dateKey.value))
const hidden = ref<string[]>([])
const colsKey = computed(() => `cms:list-columns:${entity.value}`)
onMounted(() => {
  try {
    hidden.value = JSON.parse(localStorage.getItem(colsKey.value) || '[]')
  }
  catch { /* storage blocked: all columns */ }
})
function toggleColumn(key: string, show: boolean) {
  hidden.value = show ? hidden.value.filter((k) => k !== key) : [...hidden.value, key]
  try {
    localStorage.setItem(colsKey.value, JSON.stringify(hidden.value))
  }
  catch { /* storage blocked: for this visit only */ }
}
const otherCols = computed(() => optionalCols.value.filter((k) => !hidden.value.includes(k)))
const columnItems = computed<DropdownMenuItem[]>(() => [
  { type: 'label', label: t('list.columns') },
  ...optionalCols.value.map((k) => ({
    type: 'checkbox' as const, label: fieldLabel(fieldOf(k)) || k, checked: !hidden.value.includes(k),
    onUpdateChecked: (v: boolean) => toggleColumn(k, v), onSelect: (e: Event) => e.preventDefault(),
  })),
])

function toggleSort(key: string) {
  if (sort.value === key) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  else { sort.value = key; dir.value = key === 'updatedAt' ? 'desc' : 'asc' }
}
const ariaSort = (key: string) => (sort.value === key ? (dir.value === 'asc' ? 'ascending' : 'descending') : undefined)
const rowTitle = (row: any) => (titleKey.value && row[titleKey.value]) || t('common.untitled')
const thumbOf = (row: any) => (thumbKey.value ? row[`${thumbKey.value}__media`] : null)
const range = computed(() => {
  const from = total.value ? (page.value - 1) * limit + 1 : 0
  return t('list.range', { from: formatNumber(from), to: formatNumber(Math.min(page.value * limit, total.value)), total: formatNumber(total.value) })
})

// ── selection and bulk actions (each entry through its own rules) ──
const selected = ref<Set<string>>(new Set())
watch(rows, () => { selected.value = new Set([...selected.value].filter((id) => rows.value.some((r) => r.id === id))) })
const allSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.id)))
function toggleRow(id: string, on: boolean) {
  const next = new Set(selected.value)
  if (on) next.add(id)
  else next.delete(id)
  selected.value = next
}
function toggleAll(on: boolean) { selected.value = on ? new Set(rows.value.map((r) => r.id)) : new Set() }
const bulkBusy = ref(false)
const confirmBulkDelete = ref(false)
const selectedRows = computed(() => rows.value.filter((r) => selected.value.has(r.id)))
// Offer only what changes something: Publish when a draft is selected, Take off the
// website when something selected is on it.
const anyDraftSelected = computed(() => selectedRows.value.some((r) => !isLive(r)))
const anyLiveSelected = computed(() => selectedRows.value.some(isLive))
const confirm = useCmsConfirm()
const askUnpublish = (count: number) => confirm({
  title: t('list.unpublishTitle', { count }), description: t('list.unpublishBody', { count }),
  icon: 'i-lucide-eye-off', confirmLabel: t('editor.unpublish'), color: 'warning',
})
async function runBulk(action: 'publish' | 'unpublish' | 'delete') {
  const p = publish.value
  // Each entry only where it changes: publishing what is live already (or taking a
  // draft off the website) would only count wrong in the message.
  const targets = selectedRows.value.filter((r) => action === 'delete' || (action === 'publish' ? !isLive(r) : isLive(r)))
  if (!targets.length) return
  if (action === 'unpublish' && !await askUnpublish(targets.length)) return
  bulkBusy.value = true
  let ok = 0
  let failed = 0
  for (const row of targets) {
    try {
      const url: string = `/api/cms/${entity.value}/${row.id}`
      if (action === 'delete') await $fetch(url, { method: 'DELETE' })
      else {
        const body: Record<string, any> = { [p!.field]: action === 'publish' ? p!.publishedValue : p!.draftValue }
        await $fetch(url, { method: 'PATCH', body })
      }
      ok++
    }
    catch {
      failed++
    }
  }
  bulkBusy.value = false
  confirmBulkDelete.value = false
  selected.value = new Set()
  toast.add({
    title: t(action === 'delete' ? 'list.bulkDeleted' : action === 'publish' ? 'list.bulkPublished' : 'list.bulkUnpublished', { count: ok }),
    description: failed ? t('list.bulkFailed', { count: failed }) : undefined,
    icon: failed ? 'i-lucide-triangle-alert' : 'i-lucide-check', color: failed ? 'warning' : 'success',
  })
  refreshAll()
}

// ── manual order: drag rows (or move them with the keyboard), then save ──
const arranging = ref(false)
const arrangeRows = ref<any[]>([])
const arrangeTooMany = ref(false)
const savingOrder = ref(false)
async function startArrange() {
  const res = await cmsFetch<{ rows: any[]; total: number }>(`/api/cms/${entity.value}`, { query: { sort: orderField.value, dir: 'asc', limit: 100 } })
  arrangeTooMany.value = res.total > res.rows.length
  arrangeRows.value = res.rows
  arrangedFrom.value = res.rows.map((r) => r.id)
  selected.value = new Set()
  arranging.value = true
}
// A new order that was not saved yet is lost on leaving: ask, like an unsaved form.
const arrangedFrom = ref<string[]>([])
const orderChanged = computed(() => arranging.value && arrangeRows.value.map((r) => r.id).join() !== arrangedFrom.value.join())
async function askToLeaveOrder() {
  if (!orderChanged.value) return true
  return confirm({
    title: t('list.orderUnsavedTitle'), description: t('list.orderUnsavedBody'), icon: 'i-lucide-arrow-up-down',
    cancelLabel: t('editor.stay'), confirmLabel: t('editor.leave'), color: 'warning',
  })
}
onBeforeRouteLeave(askToLeaveOrder)
onBeforeRouteUpdate((to, from) => (to.path !== from.path ? askToLeaveOrder() : true))
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!orderChanged.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
const dragFrom = ref<number | null>(null)
function onDragOver(i: number) {
  const from = dragFrom.value
  if (from === null || from === i) return
  const list = [...arrangeRows.value]
  const [moved] = list.splice(from, 1)
  list.splice(i, 0, moved)
  arrangeRows.value = list
  dragFrom.value = i
}
function move(i: number, delta: number) {
  const j = i + delta
  if (j < 0 || j >= arrangeRows.value.length) return
  const list = [...arrangeRows.value]
  ;[list[i], list[j]] = [list[j], list[i]]
  arrangeRows.value = list
}
async function saveOrder() {
  savingOrder.value = true
  try {
    await cmsFetch(`/api/cms/${entity.value}/_order`, { method: 'POST', body: { ids: arrangeRows.value.map((r) => r.id) } })
    toast.add({ title: t('list.orderSaved'), icon: 'i-lucide-check', color: 'success' })
    arrangedFrom.value = arrangeRows.value.map((r) => r.id)
    arranging.value = false
    sort.value = orderField.value!
    dir.value = 'asc'
    refresh()
  }
  catch (e: any) {
    toast.add({ title: t('team.actionFailed'), description: e?.data?.statusMessage, icon: 'i-lucide-x', color: 'error' })
  }
  finally {
    savingOrder.value = false
  }
}

// ── row actions ──
async function setPublished(row: any, next: boolean) {
  const p = publish.value
  if (!p) return
  if (!next && !await askUnpublish(1)) return
  try {
    const url: string = `/api/cms/${entity.value}/${row.id}`
    const body: Record<string, any> = { [p.field]: next ? p.publishedValue : p.draftValue }
    await $fetch(url, { method: 'PATCH', body })
    toast.add({ title: next ? t('editor.publishedToast') : t('editor.unpublishedToast'), icon: 'i-lucide-check', color: 'success' })
    refreshAll()
  }
  catch (e: any) {
    toast.add({ title: t('team.actionFailed'), description: e.data?.statusMessage, icon: 'i-lucide-x', color: 'error' })
  }
}
function rowMenu(row: any): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = []
  const p = publish.value
  if (p && meta.value?.can?.publish !== false) {
    const live = row[p.field] === p.publishedValue
    groups.push([live
      ? { label: t('editor.unpublish'), icon: 'i-lucide-eye-off', onSelect: () => setPublished(row, false) }
      : { label: t('editor.publish'), icon: 'i-lucide-globe', onSelect: () => setPublished(row, true) }])
  }
  const entry: DropdownMenuItem[] = []
  const path = rowPublicPath(row)
  if (path && (!p || isLive(row))) entry.push({ label: t('editor.viewOnSite'), icon: 'i-lucide-arrow-up-right', to: path, target: '_blank' })
  if (meta.value?.can?.create !== false && !meta.value?.singleton) entry.push({ label: t('editor.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicateRow(row) })
  if (entry.length) groups.push(entry)
  if (meta.value?.can?.delete !== false) {
    groups.push([{ label: t('editor.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => deleteRow(row) }])
  }
  return groups
}
const entryActions = useCmsEntryActions()
// The CSV holds what the list shows: the same search, status tab and filters.
const exportHref = computed(() => {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(route.query)) {
    if ((k === 'q' || k === 'status' || k.startsWith('filter.')) && typeof v === 'string' && v) params.set(k, v)
  }
  const qs = params.toString()
  return `/api/cms/${entity.value}/_export${qs ? '?' + qs : ''}`
})
async function duplicateRow(row: any) {
  const copy = await entryActions.duplicate(entity.value, meta.value, row.id)
  if (copy) await router.push(`/admin/${entity.value}/${copy}`)
}
async function deleteRow(row: any) {
  if (await entryActions.remove(entity.value, meta.value, row.id, rowTitle(row))) refreshAll()
}
/** The entry's address on the website, in the default language (from the preview template). */
function rowPublicPath(row: any): string | null {
  const paths: Record<string, string> | null = meta.value?.previewPaths ?? null
  if (!paths) return null
  const template = paths[meta.value?.locales?.default ?? ''] ?? Object.values(paths)[0]
  if (!template) return null
  let ok = true
  const out = template.replace(/:(\w+)/g, (_m: string, k: string) => {
    const v = row[k]
    if (v === undefined || v === null || v === '') ok = false
    return encodeURIComponent(String(v ?? ''))
  })
  return ok ? out : null
}
// Translations: name only what is missing ("EN missing"), nothing when all are there.
const missingLocales = (row: any) => (meta.value?.locales?.all ?? []).filter((code: string) => !(row.__locales ?? []).includes(code))
const isLive = (row: any) => !!publish.value && row[publish.value.field] === publish.value.publishedValue
// Grid: pictures that are the content (album covers) fill the card; logos sit whole on a light tile.
const gridFill = computed(() => !!publish.value)
// Dated lists, grouped by month.
const monthGroups = computed(() => {
  const out: { label: string; rows: any[] }[] = []
  for (const row of rows.value) {
    const label = dateKey.value && row[dateKey.value] ? formatDateWith(row[dateKey.value], { month: 'long', year: 'numeric' }) : t('common.none')
    const last = out[out.length - 1]
    if (last?.label === label) last.rows.push(row)
    else out.push({ label, rows: [row] })
  }
  return out
})
const leaf = (d: any) => ({
  day: formatDateWith(d, { day: 'numeric' }).replace('.', ''),
  month: formatDateWith(d, { month: 'short' }).replace('.', ''),
})
const whenTabs = computed(() => [
  { value: 'upcoming', label: t('list.upcoming') },
  { value: 'past', label: t('list.past') },
])

const tabs = computed(() => [
  { value: 'all', label: t('list.all') },
  { value: 'published', label: t('editor.published') },
  ...(publish.value?.dateField ? [{ value: 'scheduled', label: t('editor.scheduled') }] : []),
  { value: 'draft', label: t('editor.draft') },
])
</script>

<template>
  <CmsPage v-if="graph && !meta" :title="t('nav.notFoundTitle')">
    <CmsEmptyState variant="no-results" icon="i-lucide-map-pin-off" :title="t('nav.notFoundTitle')" :description="t('nav.notFoundBody')">
      <template #actions>
        <UButton to="/admin" color="neutral" variant="outline" icon="i-lucide-house">{{ t('nav.home') }}</UButton>
      </template>
    </CmsEmptyState>
  </CmsPage>
  <CmsSingletonForm v-else-if="meta?.singleton" :entity="entity" :meta="meta" />
  <CmsPage
    v-else :title="title" :description="tl(meta?.description) || undefined"
    :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: title }]"
  >
    <template #badge>
      <span v-if="total && !dateKey" class="cms-display text-[1.75rem] leading-tight text-dimmed tabular-nums">{{ formatNumber(total) }}</span>
    </template>
    <template #actions>
      <UTooltip :text="t('list.exportHint')">
        <UButton
          :href="exportHref" download external color="neutral" variant="ghost" icon="i-lucide-download"
          :aria-label="t('list.export')"
        ><span class="max-md:hidden">{{ t('list.export') }}</span></UButton>
      </UTooltip>
      <UButton v-if="canCreate" :to="`/admin/${entity}/new`" icon="i-lucide-plus">
        <span class="max-sm:sr-only">{{ entitySingular(meta) }}</span>
      </UButton>
    </template>

    <!-- a page tree: indented pages, dragged or moved into place -->
    <CmsTreeList v-if="layout === 'tree'" :entity="entity" :meta="meta" :can-create="canCreate" />

    <template v-else>
    <!-- In progress: drafts and scheduled entries, what people come back for -->
    <section v-if="showProgress && !arranging" class="mb-8" :aria-label="t('list.inProgress')">
      <h2 class="cms-label mb-2">{{ t('list.inProgress') }}</h2>
      <ul class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <li v-for="p in inProgress" :key="p.row.id" class="cms-card relative flex min-w-0 items-center gap-3 p-3 hover:border-accented transition-colors">
          <img
            v-if="thumbOf(p.row)?.url" :src="thumbOf(p.row).url" alt="" loading="lazy" decoding="async"
            class="size-11 shrink-0 rounded-md object-cover border border-default"
          >
          <div v-else-if="thumbKey" class="size-11 shrink-0 rounded-md bg-elevated" />
          <div class="min-w-0 flex-1">
            <NuxtLink :to="`/admin/${entity}/${p.row.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:inset-0">{{ rowTitle(p.row) }}</NuxtLink>
            <p class="truncate text-xs text-muted flex items-center gap-1.5">
              <CmsStatusBadge :published="p.kind === 'scheduled'" :scheduled-for="publish?.dateField ? p.row[publish.dateField] : null" class="!text-xs" />
              <span aria-hidden="true">·</span>
              <CmsTime :value="p.row.updatedAt" relative />
            </p>
          </div>
          <UButton
            :to="`/admin/${entity}/${p.row.id}`" size="sm" class="relative shrink-0 max-sm:hidden"
            :color="p.kind === 'draft' ? 'primary' : 'neutral'" :variant="p.kind === 'draft' ? 'solid' : 'outline'"
          >{{ p.kind === 'draft' ? t('home.finish') : t('common.edit') }}</UButton>
        </li>
      </ul>
    </section>

    <!-- arranging: the hint and save; with rows selected: bulk actions; else: tabs, filters, search -->
    <div v-if="arranging" class="flex flex-wrap items-center justify-between gap-3 mb-3 min-h-8">
      <p class="text-sm text-muted">{{ t('list.arrangeHint') }}</p>
      <div class="flex gap-2">
        <UButton color="neutral" variant="ghost" size="sm" @click="arranging = false">{{ t('common.cancel') }}</UButton>
        <UButton size="sm" icon="i-lucide-check" :loading="savingOrder" :disabled="arrangeTooMany" @click="saveOrder">{{ t('list.saveOrder') }}</UButton>
      </div>
    </div>
    <div v-else-if="selected.size" class="flex flex-wrap items-center gap-2 mb-3 min-h-8" role="toolbar" :aria-label="t('list.bulkActions')">
      <span class="text-sm text-highlighted tabular-nums mr-2">{{ t('list.selected', { count: selected.size }) }}</span>
      <UButton v-if="canPublish && anyDraftSelected" size="sm" color="neutral" variant="outline" icon="i-lucide-globe" :loading="bulkBusy" @click="runBulk('publish')">{{ t('editor.publish') }}</UButton>
      <UButton v-if="canPublish && anyLiveSelected" size="sm" color="neutral" variant="outline" icon="i-lucide-eye-off" :disabled="bulkBusy" @click="runBulk('unpublish')">{{ t('editor.unpublish') }}</UButton>
      <UButton v-if="canDelete" size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="bulkBusy" @click="confirmBulkDelete = true">{{ t('common.delete') }}</UButton>
      <UButton size="sm" color="neutral" variant="link" @click="toggleAll(false)">{{ t('list.clearSelection') }}</UButton>
    </div>
    <div v-else class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
      <div class="cms-scroll-x flex items-center gap-x-4 gap-y-2 min-w-0 max-w-full">
        <UTabs
          v-if="dateKey" v-model="when" :items="whenTabs" :content="false" variant="link" size="sm"
          :ui="{ list: 'border-0 gap-4', trigger: 'px-0' }"
        />
        <UTabs
          v-else-if="publish" v-model="status" :items="tabs" :content="false" variant="link" size="sm"
          :ui="{ list: 'border-0 gap-4', trigger: 'px-0 whitespace-nowrap' }"
        />
        <CmsListFilters v-if="filterable.length" v-model="filters" :fields="filterable" />
      </div>
      <div class="flex items-center gap-1 w-full sm:w-auto">
        <UInput
          v-model="q" icon="i-lucide-search" :placeholder="t('common.search')" :loading="fetchStatus === 'pending'"
          size="sm" variant="ghost" class="w-full sm:w-64" :aria-label="t('common.search')"
        >
          <template v-if="q" #trailing>
            <UButton color="neutral" variant="link" size="xs" icon="i-lucide-x" :aria-label="t('common.clear')" @click="q = ''" />
          </template>
        </UInput>
        <UDropdownMenu v-if="optionalCols.length && layout === 'table'" :items="columnItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-columns-3" :aria-label="t('list.columns')" class="max-sm:hidden" />
        </UDropdownMenu>
        <UTooltip v-if="orderField && meta?.can?.update !== false" :text="t('list.arrange')">
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-up-down" :aria-label="t('list.arrange')" @click="startArrange" />
        </UTooltip>
      </div>
    </div>

    <div :class="layout === 'grid' && !arranging && rows.length ? '' : 'cms-card overflow-hidden'">
      <ol v-if="arranging" :aria-label="t('list.arrange')">
        <li
          v-for="(row, i) in arrangeRows" :key="row.id" draggable="true"
          class="flex items-center gap-3 px-4 py-2.5 border-b border-default last:border-0"
          :class="dragFrom === i ? 'bg-elevated' : ''"
          @dragstart="dragFrom = i" @dragover.prevent="onDragOver(i)" @dragend="dragFrom = null" @drop.prevent="dragFrom = null"
        >
          <UIcon name="i-lucide-grip-vertical" class="size-4 shrink-0 text-dimmed cursor-grab" aria-hidden="true" />
          <span class="w-6 shrink-0 text-xs text-dimmed tabular-nums">{{ i + 1 }}</span>
          <img v-if="thumbOf(row)?.url" :src="thumbOf(row).url" alt="" class="size-8 shrink-0 rounded object-contain bg-white border border-default">
          <span class="flex-1 min-w-0 truncate text-sm text-highlighted">{{ rowTitle(row) }}</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up" :disabled="i === 0" :aria-label="t('list.moveUp', { name: rowTitle(row) })" @click="move(i, -1)" />
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-down" :disabled="i === arrangeRows.length - 1" :aria-label="t('list.moveDown', { name: rowTitle(row) })" @click="move(i, 1)" />
        </li>
        <li v-if="arrangeTooMany" class="px-4 py-2.5 text-xs text-muted">{{ t('list.arrangeTooMany') }}</li>
      </ol>
      <CmsEmptyState v-else-if="error" variant="error" :title="t('list.loadFailed')" :description="error.statusMessage">
        <template #actions>
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="refresh()">{{ t('list.retry') }}</UButton>
        </template>
      </CmsEmptyState>

      <CmsEmptyState
        v-else-if="!rows.length && fetchStatus !== 'pending' && narrowed"
        variant="no-results" :title="q ? t('list.noResultsTitle', { q }) : t('list.emptyTitle', { label: title.toLowerCase() })"
        :description="q ? t('list.noResultsDescription') : undefined"
      >
        <template v-if="q" #actions>
          <UButton color="neutral" variant="outline" @click="q = ''">{{ t('list.clearSearch') }}</UButton>
        </template>
      </CmsEmptyState>

      <CmsEmptyState
        v-else-if="!rows.length && fetchStatus !== 'pending' && dateKey && when === 'upcoming'"
        variant="no-results" :title="t('list.nothingUpcoming')" :description="t('list.nothingUpcomingBody')"
      >
        <template v-if="canCreate" #actions>
          <UButton :to="`/admin/${entity}/new`" icon="i-lucide-plus">{{ entitySingular(meta) }}</UButton>
        </template>
      </CmsEmptyState>

      <CmsEmptyState
        v-else-if="!rows.length && fetchStatus !== 'pending'"
        :icon="meta?.icon" :character="entity" :title="t('list.emptyTitle', { label: title.toLowerCase() })"
        :description="tl(meta?.description) || t('list.emptyDescription')"
      >
        <template v-if="canCreate" #actions>
          <UButton :to="`/admin/${entity}/new`" icon="i-lucide-plus">{{ t('list.emptyAction') }}</UButton>
        </template>
      </CmsEmptyState>

      <!-- grid: the picture is the point (logos, albums) -->
      <ul v-else-if="layout === 'grid'" class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <li v-for="row in rows" :key="row.id" class="cms-card group relative overflow-hidden p-2.5 hover:border-accented transition-colors">
          <div class="aspect-[4/3] overflow-hidden rounded-lg" :class="gridFill ? 'bg-elevated' : 'bg-[#F7F7F5]'">
            <img
              v-if="thumbOf(row)?.url" :src="thumbOf(row).url" :alt="''" loading="lazy" decoding="async"
              class="size-full" :class="gridFill ? 'object-cover' : 'object-contain p-4'"
            >
            <!-- no picture yet: the name stands in, as it does on the website -->
            <div v-else class="size-full grid place-items-center px-4 text-center cms-display text-base text-muted">
              {{ rowTitle(row) }}
            </div>
          </div>
          <div class="flex items-start justify-between gap-2 pt-2.5 px-0.5">
            <div class="min-w-0">
              <NuxtLink :to="`/admin/${entity}/${row.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:inset-0" :aria-label="t('list.openItem', { name: rowTitle(row) })">{{ rowTitle(row) }}</NuxtLink>
              <p class="truncate text-xs text-muted flex items-center gap-1.5">
                <CmsStatusBadge v-if="publish" :published="isLive(row)" :scheduled-for="publish.dateField ? row[publish.dateField] : null" class="!text-xs" />
                <template v-else-if="otherCols[0] && fieldOf(otherCols[0]) && row[otherCols[0]]"><CmsCell :field="fieldOf(otherCols[0])" :row="row" :entity="entity" /></template>
              </p>
            </div>
            <UDropdownMenu v-if="rowMenu(row).length" :items="rowMenu(row)" :content="{ align: 'end' }">
              <UButton class="relative z-10 -mr-1 -mt-0.5" color="neutral" variant="ghost" size="xs" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
            </UDropdownMenu>
          </div>
        </li>
      </ul>

      <!-- dated: Upcoming / Past, by month, the date first -->
      <div v-else-if="dateKey">
        <section v-for="g in monthGroups" :key="g.label">
          <h3 class="px-4 pt-3 pb-1.5 text-xs font-medium text-muted first-letter:uppercase bg-(--cms-sunken) border-b border-(--ui-border-muted)">{{ g.label }}</h3>
          <ul>
            <li v-for="row in g.rows" :key="row.id" class="relative flex items-center gap-3 px-4 py-3 border-b border-(--ui-border-muted) last:border-0 hover:bg-elevated/40 transition-colors">
              <span class="cms-date"><b>{{ leaf(row[dateKey]).day }}</b><span>{{ leaf(row[dateKey]).month }}</span></span>
              <div class="min-w-0 flex-1">
                <NuxtLink :to="`/admin/${entity}/${row.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:inset-0" :aria-label="t('list.openItem', { name: rowTitle(row) })">{{ rowTitle(row) }}</NuxtLink>
                <p class="truncate text-xs text-muted">
                  <template v-for="(key, k) in otherCols" :key="key">
                    <span v-if="k" aria-hidden="true"> · </span><CmsCell v-if="fieldOf(key)" :field="fieldOf(key)" :row="row" :entity="entity" />
                  </template>
                </p>
              </div>
              <UDropdownMenu v-if="rowMenu(row).length" :items="rowMenu(row)" :content="{ align: 'end' }">
                <UButton class="relative z-10" color="neutral" variant="ghost" size="sm" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
              </UDropdownMenu>
            </li>
          </ul>
        </section>
      </div>

      <!-- table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="max-sm:hidden">
            <tr class="border-b border-default text-muted">
              <th scope="col" class="w-10 pl-4 max-sm:hidden">
                <UCheckbox :model-value="allSelected" :aria-label="t('list.selectAll')" @update:model-value="(v: any) => toggleAll(!!v)" />
              </th>
              <th scope="col" :aria-sort="ariaSort(titleKey)" class="text-left font-medium px-4 py-2.5">
                <button type="button" class="inline-flex items-center gap-1 hover:text-highlighted" @click="toggleSort(titleKey)">
                  {{ fieldLabel(fieldOf(titleKey)) }}
                  <UIcon v-if="sort === titleKey" :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3.5" />
                </button>
              </th>
              <th v-for="key in otherCols" :key="key" scope="col" :aria-sort="ariaSort(key)" class="text-left font-medium px-4 py-2.5 whitespace-nowrap max-md:hidden">
                <button type="button" class="inline-flex items-center gap-1 hover:text-highlighted" @click="toggleSort(key)">
                  {{ fieldLabel(fieldOf(key)) || key }}
                  <UIcon v-if="sort === key" :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3.5" />
                </button>
              </th>
              <th v-if="meta?.locales" scope="col" class="text-left font-medium px-4 py-2.5 whitespace-nowrap max-lg:hidden">{{ t('translation.languages') }}</th>
              <th scope="col" :aria-sort="ariaSort('updatedAt')" class="text-right font-medium px-4 py-2.5 whitespace-nowrap max-sm:hidden">
                <button type="button" class="inline-flex items-center gap-1 hover:text-highlighted" @click="toggleSort('updatedAt')">
                  {{ t('list.updated') }}
                  <UIcon v-if="sort === 'updatedAt'" :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3.5" />
                </button>
              </th>
              <th class="w-12"><span class="sr-only">{{ t('editor.moreActions') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows" :key="row.id"
              class="relative border-b border-(--ui-border-muted) last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
            >
              <td class="relative z-10 w-10 pl-4 max-sm:hidden">
                <UCheckbox :model-value="selected.has(row.id)" :aria-label="t('list.selectItem', { name: rowTitle(row) })" @update:model-value="(v: any) => toggleRow(row.id, !!v)" />
              </td>
              <td class="px-4 py-3 w-full max-w-0 sm:min-w-56">
                <!-- one stretched link makes the whole row open the entry -->
                <NuxtLink :to="`/admin/${entity}/${row.id}`" class="absolute inset-0" :aria-label="t('list.openItem', { name: rowTitle(row) })" />
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    v-if="thumbOf(row)?.url" :src="thumbOf(row).url" alt="" loading="lazy" decoding="async"
                    class="size-10 shrink-0 rounded-md object-cover border border-default"
                  >
                  <div v-else-if="thumbKey" class="size-10 shrink-0 rounded-md bg-elevated" />
                  <div class="min-w-0">
                    <div class="font-medium text-highlighted truncate">{{ rowTitle(row) }}</div>
                    <div v-if="slugKey && row[slugKey]" class="text-xs text-muted truncate max-sm:hidden">/{{ row[slugKey] }}</div>
                    <!-- phones: the essentials in one line under the title -->
                    <div class="sm:hidden text-xs text-muted flex items-center gap-1.5 min-w-0">
                      <CmsStatusBadge v-if="publish" :published="isLive(row)" :scheduled-for="publish.dateField ? row[publish.dateField] : null" class="!text-xs shrink-0" />
                      <span v-if="publish" aria-hidden="true">·</span>
                      <CmsTime :value="row.updatedAt" relative class="truncate" />
                    </div>
                  </div>
                </div>
              </td>
              <td v-for="key in otherCols" :key="key" class="px-4 py-3 whitespace-nowrap max-md:hidden">
                <CmsStatusBadge
                  v-if="publish && key === publish.field" :published="isLive(row)"
                  :scheduled-for="publish.dateField ? row[publish.dateField] : null"
                />
                <CmsCell v-else-if="fieldOf(key)" :field="fieldOf(key)" :row="row" :entity="entity" />
                <span v-else>{{ row[key] ?? t('common.none') }}</span>
              </td>
              <td v-if="meta?.locales" class="px-4 py-3 whitespace-nowrap max-lg:hidden">
                <span v-if="missingLocales(row).length" class="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium cms-unsaved">
                  {{ t('translation.missing', { lang: missingLocales(row).map((c: string) => c.toUpperCase()).join(', ') }) }}
                </span>
                <span v-else class="text-xs text-dimmed">{{ t('translation.complete') }}</span>
              </td>
              <td class="px-4 py-3 text-right text-muted whitespace-nowrap max-sm:hidden">
                <CmsTime :value="row.updatedAt" relative />
              </td>
              <td class="px-2 py-3 text-right">
                <UDropdownMenu v-if="rowMenu(row).length" :items="rowMenu(row)" :content="{ align: 'end' }">
                  <UButton class="relative z-10" color="neutral" variant="ghost" size="sm" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
                </UDropdownMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="!arranging && total > limit" class="flex items-center justify-between mt-3 text-sm text-muted">
      <span class="tabular-nums">{{ range }}</span>
      <div class="flex gap-1">
        <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-chevron-left" :aria-label="t('common.previous')" :disabled="page <= 1" @click="page--" />
        <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-chevron-right" :aria-label="t('common.next')" :disabled="page >= pages" @click="page++" />
      </div>
    </div>

    </template>

    <!-- a form's messages are deleted after a while (defineForm retentionDays) -->
    <p v-if="meta?.preset === 'form' && meta?.retentionDays" class="mt-3 flex items-center gap-1.5 text-xs text-muted">
      <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" aria-hidden="true" />
      {{ t('list.retention', { count: meta.retentionDays }) }}
    </p>

    <UModal :open="confirmBulkDelete" :title="t('list.bulkDeleteTitle', { count: selected.size })" @update:open="(v: boolean) => { confirmBulkDelete = v }">
      <template #body>
        <p class="text-sm text-muted">{{ t('list.bulkDeleteBody') }}</p>
        <ul class="mt-3 space-y-1 text-sm text-highlighted">
          <li v-for="r in selectedRows.slice(0, 5)" :key="r.id" class="truncate">{{ rowTitle(r) }}</li>
          <li v-if="selectedRows.length > 5" class="text-muted">{{ t('list.andMore', { count: selectedRows.length - 5 }) }}</li>
        </ul>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="confirmBulkDelete = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="bulkBusy" @click="runBulk('delete')">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </CmsPage>
</template>
