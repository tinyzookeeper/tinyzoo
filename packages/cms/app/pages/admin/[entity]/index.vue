<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Collection list. Quiet by design: the count sits next to the title, status tabs
// and search share one bare row, the title cell carries the thumbnail and URL, the
// whole row opens the entry, and the rest lives behind one "…" menu.
definePageMeta({ layout: 'admin', key: (route) => route.fullPath })
const route = useRoute()
const toast = useToast()
const { t, tl, entityLabel, entitySingular, fieldLabel, formatNumber } = useCmsI18n()
const entity = computed(() => route.params.entity as string)

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const fieldOf = (key: string) => meta.value?.fields.find((f: any) => f.key === key)
const title = computed(() => entityLabel(meta.value) || entity.value)
useHead({ title })

const limit = 20
const page = ref(1)
const q = ref('')
const status = ref<'all' | 'published' | 'scheduled' | 'draft'>('all')
const sort = ref('updatedAt')
const dir = ref<'asc' | 'desc'>('desc')
watch([q, entity, status], () => { page.value = 1 })

const { data, refresh, status: fetchStatus, error } = await useFetch<{ rows: Record<string, any>[]; total: number }>((): string => `/api/cms/${entity.value}`, {
  query: { page, q, sort, dir, limit, status: computed(() => (status.value === 'all' ? undefined : status.value)) },
  watch: [entity],
})
// Someone else created, changed or deleted something here: refresh (a burst of
// changes, e.g. a bulk edit, refreshes once).
let liveRefresh: ReturnType<typeof setTimeout> | null = null
useCmsLiveTopic(`list:${entity.value}`, () => {
  liveRefresh ??= setTimeout(() => {
    liveRefresh = null
    refresh()
  }, 400)
})
onBeforeUnmount(() => { if (liveRefresh) clearTimeout(liveRefresh) })
const rows = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.total ?? 0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const canCreate = computed(() => meta.value?.can?.create !== false)
const publish = computed(() => meta.value?.publish)

// ── columns ──
const titleKey = computed(() => meta.value?.titleField as string)
const configured = computed<string[]>(() => meta.value?.listColumns ?? [])
const thumbKey = computed(() => configured.value.find((k) => fieldOf(k)?.type === 'media'))
const slugKey = computed(() => (meta.value?.fields ?? []).find((f: any) => f.type === 'slug')?.key as string | undefined)
const otherCols = computed(() => configured.value.filter((k) => k !== titleKey.value && k !== thumbKey.value && k !== slugKey.value))

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
    if (next && p.dateField && !row[p.dateField]) body[p.dateField] = new Date().toISOString()
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

    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
      <UTabs
        v-if="publish" v-model="status" :items="tabs" :content="false" variant="link" size="sm"
        :ui="{ list: 'border-0 gap-4', trigger: 'px-0' }"
      />
      <span v-else />
      <UInput
        v-model="q" icon="i-lucide-search" :placeholder="t('common.search')" :loading="fetchStatus === 'pending'"
        size="sm" variant="ghost" class="w-full sm:w-64" :aria-label="t('common.search')"
      >
        <template v-if="q" #trailing>
          <UButton color="neutral" variant="link" size="xs" icon="i-lucide-x" :aria-label="t('common.clear')" @click="q = ''" />
        </template>
      </UInput>
    </div>

    <div class="cms-card overflow-hidden">
      <CmsEmptyState v-if="error" variant="error" :title="t('list.loadFailed')" :description="error.statusMessage">
        <template #actions>
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="refresh()">{{ t('list.retry') }}</UButton>
        </template>
      </CmsEmptyState>

      <CmsEmptyState
        v-else-if="!rows.length && fetchStatus !== 'pending' && (q || status !== 'all')"
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

    <div v-if="total > limit" class="flex items-center justify-between mt-3 text-sm text-muted">
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
  </CmsPage>
</template>
