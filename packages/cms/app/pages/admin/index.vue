<script setup lang="ts">
// Admin home: pick up where you left off, or start something new. One narrow column,
// no cards — the sidebar already lists every collection and setting.
definePageMeta({ layout: 'admin' })

const { t, entitySingular } = useCmsI18n()
const { user } = useUserSession()
const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const { data: overview } = await useFetch<{ counts: Record<string, number>; recent: any[] }>('/api/cms/_overview')

useHead({ title: () => t('nav.home') })

const byName = computed(() => new Map((graph.value ?? []).map((e) => [e.name, e])))
const recent = computed(() => (overview.value?.recent ?? []).slice(0, 5))
const createItems = computed(() => (graph.value ?? [])
  .filter((e) => !e.singleton && e.can?.create !== false)
  .map((e) => ({ name: e.name, label: entitySingular(e), icon: e.icon })))

// Greeting by the admin's clock (the configured time zone, so server and browser agree).
const config = useCmsAdminConfig()
const greeting = computed(() => {
  const first = (user.value?.name ?? '').split(/\s+/)[0]
  if (!first) return t('home.greetingAnonymous')
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: config.value.timeZone }).format(new Date()))
  const part = hour < 11 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return t(`home.greeting.${part}`, { name: first })
})
</script>

<template>
  <CmsPage :breadcrumbs="[{ label: t('nav.home') }]">
    <div class="mx-auto max-w-2xl space-y-10 pt-2">
      <h1 class="text-xl font-semibold text-highlighted tracking-tight">{{ greeting }}</h1>

      <section>
        <h2 class="text-xs font-medium text-muted mb-2">{{ t('home.continue') }}</h2>
        <ul v-if="recent.length" class="-mx-3">
          <li v-for="item in recent" :key="`${item.entity}:${item.id}`">
            <NuxtLink :to="`/admin/${item.entity}/${item.id}`" class="flex items-center gap-3 rounded-(--ui-radius) px-3 py-2.5 hover:bg-elevated/60 transition-colors">
              <UIcon :name="byName.get(item.entity)?.icon ?? 'i-lucide-file'" class="size-4 text-dimmed shrink-0" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ item.title || t('common.untitled') }}</span>
              <CmsStatusBadge v-if="item.published !== null" :published="item.published" class="hidden sm:inline-flex shrink-0" />
              <span class="text-xs text-muted whitespace-nowrap shrink-0">
                {{ entitySingular(byName.get(item.entity)) }} · <CmsTime :value="item.updatedAt" relative />
              </span>
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">{{ t('home.recentEmpty') }}</p>
      </section>

      <section v-if="createItems.length">
        <h2 class="text-xs font-medium text-muted mb-2">{{ t('home.createSection') }}</h2>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="c in createItems" :key="c.name" :to="`/admin/${c.name}/new`"
            color="neutral" variant="outline" size="sm" :icon="c.icon"
          >{{ c.label }}</UButton>
        </div>
      </section>
    </div>
  </CmsPage>
</template>
