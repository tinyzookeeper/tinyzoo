<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const toast = useToast()
const entity = computed(() => route.params.entity as string)

const { data: graph } = await useFetch('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const fieldOf = (key: string) => meta.value?.fields.find((f: any) => f.key === key)

const limit = 20
const page = ref(1)
const q = ref('')
const sort = ref('createdAt')
const dir = ref<'asc' | 'desc'>('desc')
watch([q, entity], () => { page.value = 1 })

const { data, refresh, status } = await useFetch(() => `/api/cms/${entity.value}`, {
  query: { page, q, sort, dir, limit },
  watch: [entity],
})
const rows = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.total ?? 0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

function toggleSort(key: string) {
  if (sort.value === key) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  else { sort.value = key; dir.value = 'asc' }
}
const goodValues = new Set(['published', 'active', 'live', 'on'])
function badgeColor(v: string) { return goodValues.has(String(v)) ? 'success' : 'neutral' }
function text(v: any) {
  if (v == null || v === '') return '—'
  if (typeof v === 'object') return '{…}'
  return String(v)
}

const deleting = ref<string | null>(null)
async function del(id: string) {
  deleting.value = id
  try {
    await $fetch(`/api/cms/${entity.value}/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Deleted', icon: 'i-lucide-check', color: 'success' })
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Delete failed', description: e.data?.statusMessage, icon: 'i-lucide-x', color: 'error' })
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <div>
    <header class="h-16 border-b border-default bg-default/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-8 gap-4">
      <div class="flex items-center gap-2 min-w-0">
        <ULink to="/admin" class="text-muted hover:text-default text-sm">Dashboard</ULink>
        <UIcon name="i-lucide-chevron-right" class="size-3.5 text-dimmed" />
        <h1 class="text-lg font-semibold truncate">{{ meta?.label ?? entity }}</h1>
        <UBadge v-if="total" color="neutral" variant="subtle" size="sm">{{ total }}</UBadge>
      </div>
      <UButton v-if="meta?.can?.create !== false" :to="`/admin/${entity}/new`" icon="i-lucide-plus" size="sm">New</UButton>
    </header>

    <div class="p-8">
      <div class="mb-4 max-w-xs">
        <UInput v-model="q" icon="i-lucide-search" placeholder="Search…" :loading="status === 'pending'" class="w-full" />
      </div>

      <div class="rounded-xl border border-default bg-default overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default bg-elevated/40">
              <th
                v-for="key in meta?.listColumns" :key="key"
                class="text-left font-medium text-muted px-4 py-2.5 capitalize cursor-pointer select-none hover:text-default"
                @click="toggleSort(key)"
              >
                <span class="inline-flex items-center gap-1">
                  {{ key }}
                  <UIcon
                    v-if="sort === key"
                    :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                    class="size-3.5"
                  />
                </span>
              </th>
              <th class="w-20" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows" :key="row.id"
              class="border-b border-default last:border-0 hover:bg-elevated/40 transition group"
            >
              <td v-for="key in meta?.listColumns" :key="key" class="px-4 py-3">
                <NuxtLink :to="`/admin/${entity}/${row.id}`" class="block">
                  <UBadge v-if="fieldOf(key)?.type === 'select'" :color="badgeColor(row[key])" variant="subtle">{{ row[key] }}</UBadge>
                  <template v-else-if="fieldOf(key)?.type === 'media'">
                    <img
                      v-if="row[`${key}__media`]?.mime?.startsWith('image/')"
                      :src="row[`${key}__media`].url"
                      :width="row[`${key}__media`].width || undefined"
                      :height="row[`${key}__media`].height || undefined"
                      loading="lazy" decoding="async"
                      class="size-9 rounded object-cover border border-default"
                    >
                    <UIcon v-else-if="row[`${key}__media`]" name="i-lucide-file" class="size-5 text-dimmed" />
                    <span v-else class="text-dimmed">—</span>
                  </template>
                  <span v-else-if="fieldOf(key)?.relation?.kind === 'many-to-one'">{{ row[`${key}__label`] ?? '—' }}</span>
                  <span v-else-if="fieldOf(key)?.type === 'datetime'" class="text-muted">{{ row[key] ? new Date(row[key]).toLocaleDateString() : '—' }}</span>
                  <code v-else-if="fieldOf(key)?.type === 'slug'" class="text-xs text-muted">{{ row[key] }}</code>
                  <span v-else>{{ text(row[key]) }}</span>
                </NuxtLink>
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <div class="opacity-0 group-hover:opacity-100 transition flex items-center justify-end gap-0.5">
                  <UButton :to="`/admin/${entity}/${row.id}`" size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" />
                  <UButton
                    v-if="meta?.can?.delete !== false"
                    size="xs" variant="ghost" color="error" icon="i-lucide-trash-2"
                    :loading="deleting === row.id" @click="del(row.id)"
                  />
                </div>
              </td>
            </tr>

            <tr v-if="!rows.length && status !== 'pending'">
              <td :colspan="(meta?.listColumns?.length ?? 1) + 1" class="px-4 py-16 text-center">
                <UIcon name="i-lucide-inbox" class="size-8 text-dimmed mx-auto mb-2" />
                <p class="text-muted">{{ q ? 'No matches.' : `No ${meta?.label?.toLowerCase()} yet.` }}</p>
                <UButton v-if="!q && meta?.can?.create !== false" :to="`/admin/${entity}/new`" variant="link" size="sm">Create the first one →</UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pages > 1" class="flex items-center justify-between mt-4 text-sm text-muted">
        <span>Page {{ page }} of {{ pages }} · {{ total }} total</span>
        <div class="flex gap-1">
          <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-chevron-left" :disabled="page <= 1" @click="page--" />
          <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-chevron-right" :disabled="page >= pages" @click="page++" />
        </div>
      </div>
    </div>
  </div>
</template>
