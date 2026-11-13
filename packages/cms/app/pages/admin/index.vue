<script setup lang="ts">
// Admin home: a greeting, one way to create something, what there is to manage,
// and what was edited last — work-oriented, not a schema browser.
definePageMeta({ layout: 'admin' })

const { t, tl, entityLabel, entitySingular } = useCmsI18n()
const { user } = useUserSession()
const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const { data: overview } = await useFetch<{ counts: Record<string, number>; recent: any[] }>('/api/cms/_overview')

useHead({ title: () => t('nav.home') })

const collections = computed(() => (graph.value ?? []).filter((e) => !e.singleton))
const settings = computed(() => (graph.value ?? []).filter((e) => e.singleton))
const byName = computed(() => new Map((graph.value ?? []).map((e) => [e.name, e])))

// Greeting by the admin's clock. Rendered on the server too, so it uses the
// configured time zone rather than the machine's.
const config = useCmsAdminConfig()
const greeting = computed(() => {
  const first = (user.value?.name ?? '').split(/\s+/)[0]
  if (!first) return t('home.greetingAnonymous')
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: config.value.timeZone }).format(new Date()))
  const part = hour < 11 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return t(`home.greeting.${part}`, { name: first })
})

const createItems = computed(() => collections.value
  .filter((e) => e.can?.create !== false)
  .map((e) => ({ label: entitySingular(e), icon: e.icon, to: `/admin/${e.name}/new` })))
</script>

<template>
  <CmsPage :title="greeting" :description="t('home.subtitle')" :breadcrumbs="[{ label: t('nav.home') }]">
    <template #actions>
      <UDropdownMenu v-if="createItems.length" :items="createItems" :content="{ align: 'end' }">
        <UButton icon="i-lucide-plus" trailing-icon="i-lucide-chevron-down">{{ t('home.create') }}</UButton>
      </UDropdownMenu>
    </template>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="space-y-6 min-w-0">
        <CmsSection :title="t('home.yourContent')" flush>
          <ul class="divide-y divide-default">
            <li v-for="e in collections" :key="e.name">
              <NuxtLink :to="`/admin/${e.name}`" class="group flex items-center gap-4 px-5 py-4 hover:bg-elevated/50 transition-colors">
                <span class="size-10 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <UIcon :name="e.icon" class="size-5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-medium text-highlighted group-hover:text-primary transition-colors">{{ entityLabel(e) }}</span>
                  <span v-if="e.description" class="block text-sm text-muted truncate">{{ tl(e.description) }}</span>
                </span>
                <span class="text-sm text-muted tabular-nums whitespace-nowrap">{{ t('common.items', { count: overview?.counts?.[e.name] ?? 0 }) }}</span>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed group-hover:text-primary transition-colors" />
              </NuxtLink>
            </li>
          </ul>
        </CmsSection>

        <CmsSection v-if="settings.length" :title="t('nav.settings')" flush>
          <ul class="divide-y divide-default">
            <li v-for="e in settings" :key="e.name">
              <NuxtLink :to="`/admin/${e.name}`" class="group flex items-center gap-4 px-5 py-3.5 hover:bg-elevated/50 transition-colors">
                <UIcon :name="e.icon" class="size-5 text-muted group-hover:text-primary" />
                <span class="min-w-0 flex-1">
                  <span class="block font-medium text-highlighted">{{ entityLabel(e) }}</span>
                  <span v-if="e.description" class="block text-sm text-muted truncate">{{ tl(e.description) }}</span>
                </span>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed group-hover:text-primary transition-colors" />
              </NuxtLink>
            </li>
          </ul>
        </CmsSection>
      </div>

      <CmsSection :title="t('home.recent')" flush class="self-start">
        <ul v-if="overview?.recent?.length" class="divide-y divide-default">
          <li v-for="item in overview.recent" :key="`${item.entity}:${item.id}`">
            <NuxtLink :to="`/admin/${item.entity}/${item.id}`" class="block px-5 py-3 hover:bg-elevated/50 transition-colors">
              <span class="flex items-center gap-2 min-w-0">
                <span class="truncate text-sm font-medium text-highlighted">{{ item.title || t('common.untitled') }}</span>
                <CmsStatusBadge v-if="item.published !== null" :published="item.published" class="shrink-0" />
              </span>
              <span class="mt-0.5 block text-xs text-muted">
                {{ entitySingular(byName.get(item.entity)) }} · <CmsTime :value="item.updatedAt" relative />
              </span>
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="px-5 py-6 text-sm text-muted">{{ t('home.recentEmpty') }}</p>
      </CmsSection>
    </div>
  </CmsPage>
</template>
