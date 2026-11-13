<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const toast = useToast()
const { t, tl, entityLabel, entitySingular, fieldLabel } = useCmsI18n()
const entity = computed(() => route.params.entity as string)

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const fieldOf = (key: string) => meta.value?.fields.find((f: any) => f.key === key)
const title = computed(() => entityLabel(meta.value) || entity.value)
useHead({ title })

const limit = 20
const page = ref(1)
const q = ref('')
const sort = ref('createdAt')
const dir = ref<'asc' | 'desc'>('desc')
watch([q, entity], () => { page.value = 1 })

const { data, refresh, status, error } = await useFetch<{ rows: Record<string, any>[]; total: number }>((): string => `/api/cms/${entity.value}`, {
  query: { page, q, sort, dir, limit },
  watch: [entity],
})
const rows = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.total ?? 0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const canCreate = computed(() => meta.value?.can?.create !== false)

function toggleSort(key: string) {
  if (sort.value === key) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  else { sort.value = key; dir.value = 'asc' }
}
const ariaSort = (key: string) => (sort.value === key ? (dir.value === 'asc' ? 'ascending' : 'descending') : undefined)
const rowTitle = (row: any) => (meta.value?.titleField && row[meta.value.titleField]) || t('common.untitled')

const deleting = ref<string | null>(null)
const pendingDelete = ref<any | null>(null)
async function confirmDelete() {
  const row = pendingDelete.value
  if (!row) return
  deleting.value = row.id
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
    deleting.value = null
  }
}
</script>

<template>
  <CmsSingletonForm v-if="meta?.singleton" :entity="entity" :meta="meta" />
  <CmsPage
    v-else
    :title="title" :description="tl(meta?.description) || undefined"
    :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: title }]"
  >
    <template #actions>
      <UButton v-if="canCreate" :to="`/admin/${entity}/new`" icon="i-lucide-plus">{{ entitySingular(meta) }}</UButton>
    </template>
    <template #meta>
      <span v-if="total" class="text-sm text-muted tabular-nums">{{ t('common.items', { count: total }) }}</span>
    </template>

    <div class="cms-card overflow-hidden">
      <div class="flex items-center gap-3 px-4 py-3 border-b border-default">
        <UInput
          v-model="q" icon="i-lucide-search" :placeholder="t('common.search')" :loading="status === 'pending'"
          class="w-full sm:max-w-xs" :aria-label="t('common.search')"
        >
          <template v-if="q" #trailing>
            <UButton color="neutral" variant="link" size="xs" icon="i-lucide-x" :aria-label="t('common.clear')" @click="q = ''" />
          </template>
        </UInput>
      </div>

      <CmsEmptyState v-if="error" variant="error" :title="t('list.loadFailed')" :description="error.statusMessage">
        <template #actions>
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="refresh()">{{ t('list.retry') }}</UButton>
        </template>
      </CmsEmptyState>

      <CmsEmptyState
        v-else-if="!rows.length && status !== 'pending' && q"
        variant="no-results" :title="t('list.noResultsTitle', { q })" :description="t('list.noResultsDescription')"
      >
        <template #actions>
          <UButton color="neutral" variant="outline" @click="q = ''">{{ t('list.clearSearch') }}</UButton>
        </template>
      </CmsEmptyState>

      <CmsEmptyState
        v-else-if="!rows.length && status !== 'pending'"
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
            <tr class="border-b border-default">
              <th
                v-for="key in meta?.listColumns" :key="key" scope="col" :aria-sort="ariaSort(key)"
                class="text-left font-medium text-muted px-4 py-2.5 whitespace-nowrap"
              >
                <button
                  type="button" class="inline-flex items-center gap-1 hover:text-highlighted transition-colors"
                  :aria-label="t('list.sortBy', { column: fieldLabel(fieldOf(key)) || key })" @click="toggleSort(key)"
                >
                  {{ fieldLabel(fieldOf(key)) || key }}
                  <UIcon v-if="sort === key" :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3.5" />
                </button>
              </th>
              <th class="w-20"><span class="sr-only">{{ t('common.edit') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows" :key="row.id"
              class="relative border-b border-default last:border-0 hover:bg-elevated/50 transition-colors group cursor-pointer"
            >
              <!-- One "stretched link" covers the whole row (the <tr> is the positioned
                   ancestor); the action buttons sit above it (relative z-10). -->
              <td v-for="(key, ci) in meta?.listColumns" :key="key" class="px-4 py-3.5 align-middle" :class="[ci === 0 ? 'font-medium text-highlighted' : '', key === meta?.titleField ? 'min-w-48 text-highlighted' : 'whitespace-nowrap']">
                <NuxtLink v-if="ci === 0" :to="`/admin/${entity}/${row.id}`" class="absolute inset-0" :aria-label="t('list.openItem', { name: rowTitle(row) })" />
                <CmsCell v-if="fieldOf(key)" :field="fieldOf(key)" :row="row" :entity="entity" />
                <span v-else>{{ row[key] ?? t('common.none') }}</span>
              </td>
              <td class="px-3 py-3 text-right whitespace-nowrap">
                <div class="relative z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-end gap-0.5">
                  <UButton :to="`/admin/${entity}/${row.id}`" size="sm" variant="ghost" color="neutral" icon="i-lucide-pencil" :aria-label="t('common.edit')" />
                  <UButton
                    v-if="meta?.can?.delete !== false"
                    size="sm" variant="ghost" color="error" icon="i-lucide-trash-2" :aria-label="t('common.delete')"
                    :loading="deleting === row.id" @click="pendingDelete = row"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pages > 1" class="flex items-center justify-between px-4 py-3 border-t border-default text-sm text-muted">
        <span class="tabular-nums">{{ t('list.pageOf', { page, pages }) }}</span>
        <div class="flex gap-1">
          <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-chevron-left" :aria-label="t('common.previous')" :disabled="page <= 1" @click="page--" />
          <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-chevron-right" :aria-label="t('common.next')" :disabled="page >= pages" @click="page++" />
        </div>
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
          <UButton color="error" icon="i-lucide-trash-2" :loading="!!deleting" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </CmsPage>
</template>
