<script setup lang="ts">
// Admin home. One brand moment (the cream welcome with an animal and the few things
// people come to add), then what needs them ("Waiting for you"), what they touched
// last, their website and what is coming up. Sections with nothing in them stay away.
definePageMeta({ layout: 'admin' })

const { t, entitySingular, entityLabel, formatDate, formatDateWith } = useCmsI18n()
const { user } = useUserSession()
const config = useCmsAdminConfig()
const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
type Item = { entity: string; id: string; title: string | null; updatedAt: string; published: boolean | null; publishAt?: string | null }
const { data: overview } = await useFetch<{ counts: Record<string, number>; recent: Item[]; drafts: Item[]; scheduled: Item[]; upcoming: { entity: string; id: string; title: string | null; at: string }[] }>('/api/cms/_overview')

useHead({ title: () => t('nav.home') })

const byName = computed(() => new Map((graph.value ?? []).map((e) => [e.name, e])))
const drafts = computed(() => (overview.value?.drafts ?? []).slice(0, 4))
const recent = computed(() => {
  const waiting = new Set(drafts.value.map((d) => `${d.entity}:${d.id}`))
  return (overview.value?.recent ?? []).filter((r) => !waiting.has(`${r.entity}:${r.id}`)).slice(0, 5)
})
// Coming soon: scheduled publications and the next dated items (events), by date.
const coming = computed(() => [
  ...(overview.value?.scheduled ?? []).map((s) => ({ entity: s.entity, id: s.id, title: s.title, at: s.publishAt!, kind: 'scheduled' as const })),
  ...(overview.value?.upcoming ?? []).map((u) => ({ ...u, kind: 'event' as const })),
].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()).slice(0, 4))

// What people come here to add: every collection they may create in. Content that
// gets published (articles, pages) leads, the rest (authors, tags) follows in
// sidebar order; the first one is the main button.
const createItems = computed(() => (graph.value ?? [])
  .filter((e) => !e.singleton && e.can?.create !== false && e.preset !== 'form' && e.preset !== 'redirects')
  .map((e, i) => ({ name: e.name, label: entitySingular(e), icon: e.icon, rank: (e.publish ? 0 : 1) * 1000 + i }))
  .sort((a, b) => a.rank - b.rank))
const quick = computed(() => createItems.value.slice(0, 3))
const moreCreate = computed(() => createItems.value.slice(3).map((c) => ({ label: c.label, icon: c.icon, to: `/admin/${c.name}/new` })))

// Greeting by the admin's clock (the configured time zone, so server and browser agree).
const greeting = computed(() => {
  const first = (user.value?.name ?? '').split(/\s+/)[0]
  if (!first) return t('home.greetingAnonymous')
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: config.value.timeZone }).format(new Date()))
  const part = hour < 11 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return t(`home.greeting.${part}`, { name: first })
})
const summary = computed(() => {
  const parts: string[] = []
  const waiting = overview.value?.drafts?.length ?? 0
  const empty = !Object.values(overview.value?.counts ?? {}).some((n) => n > 0)
  parts.push(waiting ? t('home.summaryDrafts', { count: waiting }) : empty ? t('home.summaryEmpty') : t('home.summaryCalm'))
  const next = coming.value[0]
  if (next) parts.push(t('home.summaryNext', { title: short(next.title || t('common.untitled')), date: formatDate(next.at, { time: false }) }))
  return parts.join(' ')
})

/** A title inside a sentence: long ones end with an ellipsis. */
const short = (s: string, max = 60) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

const owl = cmsCharacter('owl')
const siteHref = computed(() => config.value.siteUrl || '/')
// The site's host name needs the browser's address: shown after mount, so the page
// the server drew (the configured link) and the first browser render agree.
const siteHost = ref(siteHref.value)
onMounted(() => {
  try {
    siteHost.value = new URL(siteHref.value, location.origin).host
  }
  catch { /* keep the link as written */ }
})
const leaf = (d: string) => ({
  day: formatDateWith(d, { day: 'numeric' }).replace('.', ''),
  month: formatDateWith(d, { month: 'short' }).replace('.', ''),
})
</script>

<template>
  <CmsPage :breadcrumbs="[{ label: t('nav.home') }]">
    <template #actions>
      <UButton :to="siteHref" target="_blank" color="neutral" variant="outline" size="sm" icon="i-lucide-globe" class="max-sm:hidden">{{ t('nav.viewSite') }}</UButton>
    </template>

    <div class="mx-auto max-w-5xl">
      <!-- the welcome: the one brand moment on this page -->
      <section class="cms-moment relative flex items-center justify-between gap-6 overflow-hidden p-5 sm:px-8 sm:py-7">
        <div class="min-w-0">
          <div class="pr-14 sm:pr-0">
            <h1 class="cms-display text-2xl sm:text-[1.75rem] leading-tight text-highlighted">{{ greeting }}</h1>
            <p class="cms-moment__muted mt-1 text-sm sm:text-[0.9375rem] text-pretty">{{ summary }}</p>
          </div>
          <div v-if="createItems.length" class="mt-4 flex flex-wrap gap-2">
            <UButton
              v-for="(c, i) in quick" :key="c.name" :to="`/admin/${c.name}/new`" :icon="c.icon"
              :color="i === 0 ? 'primary' : 'neutral'" :variant="i === 0 ? 'solid' : 'outline'"
              :class="i === 0 ? '' : 'bg-(--cms-surface)'"
            >{{ c.label }}</UButton>
            <UDropdownMenu v-if="moreCreate.length" :items="moreCreate">
              <UButton color="neutral" variant="outline" icon="i-lucide-plus" class="bg-(--cms-surface)">{{ t('home.more') }}</UButton>
            </UDropdownMenu>
          </div>
        </div>
        <img :src="owl.url" alt="" class="absolute right-4 top-5 h-10 sm:static sm:h-24 w-auto shrink-0 select-none" draggable="false">
      </section>

      <div class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div class="space-y-8 min-w-0">
          <section v-if="drafts.length">
            <h2 class="cms-label mb-2 flex items-center gap-2">
              {{ t('home.waiting') }}
              <span class="rounded-full bg-elevated px-1.5 text-xs font-medium text-muted tabular-nums">{{ overview?.drafts?.length }}</span>
            </h2>
            <ul class="cms-card divide-y divide-(--ui-border-muted)">
              <li v-for="item in drafts" :key="`${item.entity}:${item.id}`" class="relative flex items-center gap-3 px-4 py-3">
                <UIcon :name="byName.get(item.entity)?.icon ?? 'i-lucide-file'" class="size-4 text-dimmed shrink-0" />
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/admin/${item.entity}/${item.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:inset-0">
                    {{ item.title || t('common.untitled') }}
                  </NuxtLink>
                  <p class="truncate text-xs text-muted">{{ t('editor.draft') }} · {{ entityLabel(byName.get(item.entity)) }} · <CmsTime :value="item.updatedAt" relative /></p>
                </div>
                <UButton :to="`/admin/${item.entity}/${item.id}`" color="neutral" variant="outline" size="sm" class="relative shrink-0 max-sm:hidden">{{ t('home.finish') }}</UButton>
              </li>
            </ul>
          </section>

          <section>
            <h2 class="cms-label mb-2">{{ t('home.recent') }}</h2>
            <ul v-if="recent.length" class="cms-card divide-y divide-(--ui-border-muted)">
              <li v-for="item in recent" :key="`${item.entity}:${item.id}`" class="relative flex items-center gap-3 px-4 py-3 hover:bg-elevated/40 transition-colors">
                <UIcon :name="byName.get(item.entity)?.icon ?? 'i-lucide-file'" class="size-4 text-dimmed shrink-0" />
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/admin/${item.entity}/${item.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:inset-0">
                    {{ item.title || t('common.untitled') }}
                  </NuxtLink>
                  <p class="truncate text-xs text-muted">{{ entityLabel(byName.get(item.entity)) }} · <CmsTime :value="item.updatedAt" relative /></p>
                </div>
                <CmsStatusBadge v-if="item.published !== null" :published="!!item.published" :scheduled-for="item.publishAt" class="shrink-0 max-sm:hidden" />
              </li>
            </ul>
            <p v-else class="text-sm text-muted">{{ t('home.recentEmpty') }}</p>
          </section>
        </div>

        <aside class="space-y-8 min-w-0">
          <section>
            <h2 class="cms-label mb-2">{{ t('home.yourSite') }}</h2>
            <a :href="siteHref" target="_blank" rel="noopener" class="cms-card group block overflow-hidden hover:border-accented transition-colors">
              <div class="relative h-36 overflow-hidden border-b border-default bg-white max-lg:hidden" aria-hidden="true">
                <ClientOnly>
                  <iframe
                    :src="siteHref" tabindex="-1" loading="lazy" title=""
                    class="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-25 border-0"
                  />
                </ClientOnly>
              </div>
              <div class="flex items-center justify-between gap-2 px-4 py-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-highlighted">{{ siteHost }}</p>
                  <p class="text-xs text-muted">{{ t('nav.viewSite') }}</p>
                </div>
                <UIcon name="i-lucide-arrow-up-right" class="size-4 text-dimmed group-hover:text-highlighted shrink-0" />
              </div>
            </a>
          </section>

          <section v-if="coming.length">
            <h2 class="cms-label mb-2">{{ t('home.comingSoon') }}</h2>
            <ul class="cms-card divide-y divide-(--ui-border-muted)">
              <li v-for="c in coming" :key="`${c.entity}:${c.id}`" class="relative flex items-center gap-3 px-4 py-3">
                <span class="cms-date"><b>{{ leaf(c.at).day }}</b><span>{{ leaf(c.at).month }}</span></span>
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/admin/${c.entity}/${c.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:inset-0">{{ c.title || t('common.untitled') }}</NuxtLink>
                  <p class="truncate text-xs text-muted">
                    <template v-if="c.kind === 'scheduled'">{{ t('home.goesLive', { time: formatDateWith(c.at, { timeStyle: 'short' }) }) }}</template>
                    <template v-else>{{ entitySingular(byName.get(c.entity)) }}</template>
                  </p>
                </div>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  </CmsPage>
</template>
