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
const { t, tl, entityLabel, entitySingular, fieldLabel, formatNumber } = useCmsI18n()
const entity = computed(() => route.params.entity as string)

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const fieldOf = (key: string) => meta.value?.fields.find((f: any) => f.key === key)
const title = computed(() => entityLabel(meta.value) || entity.value)
useHead({ title })
const publish = computed(() => meta.value?.publish)
const orderField = computed(() => (meta.value?.orderField as string | null) ?? null)

// ── the list's state, from and to the address ──
const qs = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const limit = 20
const page = ref(Math.max(1, Number(qs('page')) || 1))
const q = ref(qs('q'))
const status = ref<'all' | 'published' | 'scheduled' | 'draft'>((['published', 'scheduled', 'draft'].includes(qs('status')) ? qs('status') : 'all') as any)
const sort = ref(qs('sort') || (orderField.value ?? 'updatedAt'))
const dir = ref<'asc' | 'desc'>(qs('dir') === 'asc' || qs('dir') === 'desc' ? (qs('dir') as any) : (orderField.value && !qs('sort') ? 'asc' : 'desc'))
const filters = ref<Record<string, string>>(Object.fromEntries(Object.entries(route.query).filter(([k, v]) => k.startsWith('filter.') && typeof v === 'string')) as Record<string, string>)
watch([q, entity, status, filters], () => { page.value = 1 })

const listQuery = computed(() => ({
  page: page.value, q: q.value || undefined, sort: sort.value, dir: dir.value, limit,
  status: status.value === 'all' ? undefined : status.value, ...filters.value,
}))
let urlTimer: ReturnType<typeof setTimeout> | null = null
watch(listQuery, (lq) => {
  if (urlTimer) clearTimeout(urlTimer)
  urlTimer = setTimeout(() => {
    const query: Record<string, string> = {}
    if (lq.page > 1) query.page = String(lq.page)
    if (lq.q) query.q = lq.q
    if (lq.status) query.status = lq.status
    if (sort.value !== (orderField.value ?? 'updatedAt')) query.sort = sort.value
    if (dir.value !== (orderField.value && sort.value === orderField.value ? 'asc' : 'desc')) query.dir = dir.value
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
    if (!arranging.value) refresh()
  }, 400)
})
onBeforeUnmount(() => {
  if (liveRefresh) clearTimeout(liveRefresh)
  if (urlTimer) clearTimeout(urlTimer)
})
const rows = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.total ?? 0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const canCreate = computed(() => meta.value?.can?.create !== false)
const canDelete = computed(() => meta.value?.can?.delete !== false)
const canPublish = computed(() => !!publish.value && meta.value?.can?.publish !== false)
const narrowed = computed(() => !!q.value || status.value !== 'all' || Object.keys(filters.value).length > 0)

// ── filters: by field type (the publish status has its tabs) ──
const filterable = computed(() => (meta.value?.fields ?? []).filter((f: any) =>
  f.key !== publish.value?.field && f.key !== orderField.value
  && (['select', 'boolean', 'media', 'datetime'].includes(f.type) || f.relation?.kind === 'many-to-one' || f.relation?.kind === 'many-to-many')))

// ── columns (which ones show is remembered per collection, in this browser) ──
const titleKey = computed(() => meta.value?.titleField as string)
const configured = computed<string[]>(() => meta.value?.listColumns ?? [])
const thumbKey = computed(() => configured.value.find((k) => fieldOf(k)?.type === 'media'))
const slugKey = computed(() => (meta.value?.fields ?? []).find((f: any) => f.type === 'slug')?.key as string | undefined)
const optionalCols = computed(() => configured.value.filter((k) => k !== titleKey.value && k !== thumbKey.value && k !== slugKey.value))
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
async function runBulk(action: 'publish' | 'unpublish' | 'delete') {
  const p = publish.value
  const targets = rows.value.filter((r) => selected.value.has(r.id))
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
  refresh()
}

// ── manual order: drag rows (or move them with the keyboard), then save ──
const arranging = ref(false)
const arrangeRows = ref<any[]>([])
const arrangeTooMany = ref(false)
const savingOrder = ref(false)
async function startArrange() {
  const res = await $fetch<{ rows: any[]; total: number }>(`/api/cms/${entity.value}`, { query: { sort: orderField.value, dir: 'asc', limit: 100 } })
  arrangeTooMany.value = res.total > res.rows.length
  arrangeRows.value = res.rows
  selected.value = new Set()
  arranging.value = true
}
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
    await $fetch(`/api/cms/${entity.value}/_order`, { method: 'POST', body: { ids: arrangeRows.value.map((r) => r.id) } })
    toast.add({ title: t('list.orderSaved'), icon: 'i-lucide-check', color: 'success' })
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
const pendingDelete = ref<any | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  const row = pendingDelete.value
  if (!row) return
  deleting.value = true
  try {
    const url: string = `/api/cms/${entity.value}/${row.id}`
    await $fetch(url, { method: 'DELETE' })
    toast.add({ title: t('list.deleted'), icon: 'i-lucide-check', color: 'success' })
    pendingDelete.value = null
    refresh()
  }
  catch (e: any) {
    toast.add({ title: t('list.deleteFailed'), description: e.data?.statusMessage, icon: 'i-lucide-x', color: 'error' })
  }
  finally {
    deleting.value = false
  }
}
async function setPublished(row: any, next: boolean) {
  const p = publish.value
  if (!p) return
  try {
    const url: string = `/api/cms/${entity.value}/${row.id}`
    const body: Record<string, any> = { [p.field]: next ? p.publishedValue : p.draftValue }
    await $fetch(url, { method: 'PATCH', body })
    toast.add({ title: next ? t('editor.publishedToast') : t('editor.unpublishedToast'), icon: 'i-lucide-check', color: 'success' })
    refresh()
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
  if (meta.value?.can?.delete !== false) {
    groups.push([{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { pendingDelete.value = row } }])
  }
  return groups
}
const tabs = computed(() => [
  { value: 'all', label: t('list.all') },
  { value: 'published', label: t('editor.published') },
  ...(publish.value?.dateField ? [{ value: 'scheduled', label: t('editor.scheduled') }] : []),
  { value: 'draft', label: t('editor.draft') },
])
</script>

<template>
  <CmsSingletonForm v-if="meta?.singleton" :entity="entity" :meta="meta" />
  <CmsPage v-else :title="title" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: title }]">
    <template #badge>
      <span v-if="total" class="text-2xl font-semibold text-dimmed tabular-nums">{{ formatNumber(total) }}</span>
    </template>
    <template #actions>
      <UButton v-if="canCreate" :to="`/admin/${entity}/new`" icon="i-lucide-plus">{{ entitySingular(meta) }}</UButton>
    </template>

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
      <UButton v-if="canPublish" size="sm" color="neutral" variant="outline" icon="i-lucide-globe" :loading="bulkBusy" @click="runBulk('publish')">{{ t('editor.publish') }}</UButton>
      <UButton v-if="canPublish" size="sm" color="neutral" variant="outline" icon="i-lucide-eye-off" :disabled="bulkBusy" @click="runBulk('unpublish')">{{ t('editor.unpublish') }}</UButton>
      <UButton v-if="canDelete" size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="bulkBusy" @click="confirmBulkDelete = true">{{ t('common.delete') }}</UButton>
      <UButton size="sm" color="neutral" variant="link" @click="toggleAll(false)">{{ t('list.clearSelection') }}</UButton>
    </div>
    <div v-else class="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <UTabs
          v-if="publish" v-model="status" :items="tabs" :content="false" variant="link" size="sm"
          :ui="{ list: 'border-0 gap-4', trigger: 'px-0' }"
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
        <UDropdownMenu v-if="optionalCols.length" :items="columnItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-columns-3" :aria-label="t('list.columns')" />
        </UDropdownMenu>
        <UTooltip v-if="orderField && meta?.can?.update !== false" :text="t('list.arrange')">
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-up-down" :aria-label="t('list.arrange')" @click="startArrange" />
        </UTooltip>
      </div>
    </div>

    <div class="cms-card overflow-hidden">
      <ol v-if="arranging" :aria-label="t('list.arrange')">
        <li
          v-for="(row, i) in arrangeRows" :key="row.id" draggable="true"
          class="flex items-center gap-3 px-4 py-2.5 border-b border-default last:border-0"
          :class="dragFrom === i ? 'bg-elevated' : ''"
          @dragstart="dragFrom = i" @dragover.prevent="onDragOver(i)" @dragend="dragFrom = null" @drop.prevent="dragFrom = null"
        >
          <UIcon name="i-lucide-grip-vertical" class="size-4 shrink-0 text-dimmed cursor-grab" aria-hidden="true" />
          <span class="w-6 shrink-0 text-xs text-dimmed tabular-nums">{{ i + 1 }}</span>
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
        v-else-if="!rows.length && fetchStatus !== 'pending'"
        :icon="meta?.icon" :title="t('list.emptyTitle', { label: title.toLowerCase() })"
        :description="tl(meta?.description) || t('list.emptyDescription')"
      >
        <template v-if="canCreate" #actions>
          <UButton :to="`/admin/${entity}/new`" icon="i-lucide-plus">{{ t('list.emptyAction') }}</UButton>
        </template>
      </CmsEmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default text-muted">
              <th scope="col" class="w-10 pl-4">
                <UCheckbox :model-value="allSelected" :aria-label="t('list.selectAll')" @update:model-value="(v: any) => toggleAll(!!v)" />
              </th>
              <th scope="col" :aria-sort="ariaSort(titleKey)" class="text-left font-medium px-4 py-2.5">
                <button type="button" class="inline-flex items-center gap-1 hover:text-highlighted" @click="toggleSort(titleKey)">
                  {{ fieldLabel(fieldOf(titleKey)) }}
                  <UIcon v-if="sort === titleKey" :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3.5" />
                </button>
              </th>
              <th v-for="key in otherCols" :key="key" scope="col" :aria-sort="ariaSort(key)" class="text-left font-medium px-4 py-2.5 whitespace-nowrap">
                <button type="button" class="inline-flex items-center gap-1 hover:text-highlighted" @click="toggleSort(key)">
                  {{ fieldLabel(fieldOf(key)) || key }}
                  <UIcon v-if="sort === key" :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3.5" />
                </button>
              </th>
              <th v-if="meta?.locales" scope="col" class="text-left font-medium px-4 py-2.5 whitespace-nowrap">{{ t('translation.languages') }}</th>
              <th scope="col" :aria-sort="ariaSort('updatedAt')" class="text-right font-medium px-4 py-2.5 whitespace-nowrap">
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
              class="relative border-b border-default last:border-0 hover:bg-elevated/50 transition-colors cursor-pointer"
            >
              <td class="relative z-10 w-10 pl-4">
                <UCheckbox :model-value="selected.has(row.id)" :aria-label="t('list.selectItem', { name: rowTitle(row) })" @update:model-value="(v: any) => toggleRow(row.id, !!v)" />
              </td>
              <td class="px-4 py-3 min-w-56">
                <!-- one stretched link makes the whole row open the entry -->
                <NuxtLink :to="`/admin/${entity}/${row.id}`" class="absolute inset-0" :aria-label="t('list.openItem', { name: rowTitle(row) })" />
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    v-if="thumbOf(row)?.url" :src="thumbOf(row).url" alt="" loading="lazy" decoding="async"
                    class="size-9 shrink-0 rounded object-cover border border-default"
                  >
                  <div v-else-if="thumbKey" class="size-9 shrink-0 rounded bg-elevated" />
                  <div class="min-w-0">
                    <div class="font-medium text-highlighted truncate">{{ rowTitle(row) }}</div>
                    <div v-if="slugKey && row[slugKey]" class="text-xs text-muted truncate">/{{ row[slugKey] }}</div>
                  </div>
                </div>
              </td>
              <td v-for="key in otherCols" :key="key" class="px-4 py-3 whitespace-nowrap">
                <CmsStatusBadge
                  v-if="publish && key === publish.field" :published="row[publish.field] === publish.publishedValue"
                  :scheduled-for="publish.dateField ? row[publish.dateField] : null"
                />
                <CmsCell v-else-if="fieldOf(key)" :field="fieldOf(key)" :row="row" :entity="entity" />
                <span v-else>{{ row[key] ?? t('common.none') }}</span>
              </td>
              <td v-if="meta?.locales" class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex gap-1.5 text-xs font-medium tabular-nums">
                  <span
                    v-for="code in meta.locales.all" :key="code"
                    :class="(row.__locales ?? []).includes(code) ? 'text-default' : 'text-dimmed line-through decoration-(--ui-text-dimmed)'"
                    :title="(row.__locales ?? []).includes(code) ? t('translation.translated') : t('translation.notTranslated')"
                  >{{ code.toUpperCase() }}</span>
                </span>
              </td>
              <td class="px-4 py-3 text-right text-muted whitespace-nowrap">
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

    <UModal
      :open="!!pendingDelete" :title="t('list.deleteTitle', { name: pendingDelete ? rowTitle(pendingDelete) : '' })"
      @update:open="(v: boolean) => { if (!v) pendingDelete = null }"
    >
      <template #body>
        <p class="text-sm text-muted">{{ t('list.deleteBody') }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="pendingDelete = null">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
    <UModal :open="confirmBulkDelete" :title="t('list.bulkDeleteTitle', { count: selected.size })" @update:open="(v: boolean) => { confirmBulkDelete = v }">
      <template #body>
        <p class="text-sm text-muted">{{ t('list.deleteBody') }}</p>
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
