<script setup lang="ts">
import type { OverviewResponse, SiteSummary } from '#shared/types/keeper'

useHead({ title: 'Versions · Keeper' })
const { data, status } = await useFetch<OverviewResponse>('/api/sites', {
  key: 'overview',
  default: () => ({ sites: [], latest: null }),
})

interface Group { version: string | null; sites: SiteSummary[]; outdated: boolean; latest: boolean }
const groups = computed<Group[]>(() => {
  const by = new Map<string | null, SiteSummary[]>()
  for (const s of data.value.sites) {
    const list = by.get(s.version) ?? []
    list.push(s)
    by.set(s.version, list)
  }
  const latest = data.value.latest
  return [...by.entries()]
    .map(([version, sites]) => ({
      version,
      sites: sites.sort((a, b) => a.name.localeCompare(b.name)),
      outdated: version != null && latest != null && compareVersions(version, latest) < 0,
      latest: version != null && latest != null && compareVersions(version, latest) === 0,
    }))
    .sort((a, b) => (a.version == null ? 1 : b.version == null ? -1 : compareVersions(b.version, a.version)))
})
const behind = computed(() => groups.value.filter((g) => g.outdated).reduce((n, g) => n + g.sites.length, 0))
</script>

<template>
  <AppPage title="Versions">
    <div v-if="status === 'pending' && !data.sites.length" class="flex flex-col gap-3">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-28 w-full" />
    </div>

    <div v-else-if="!data.sites.length" class="moment rounded-2xl px-6 py-10 text-center">
      <h2 class="text-lg font-bold text-highlighted">No sites yet</h2>
      <p class="mt-1 text-muted">Once sites are added, here you see which tinyzoo each one runs.</p>
      <UButton to="/sites/new" label="Add a site" icon="i-lucide-plus" class="mt-5" />
    </div>

    <template v-else>
      <p class="text-muted">
        <template v-if="data.latest">The newest tinyzoo is <span class="font-mono text-highlighted">{{ data.latest }}</span>. </template>
        <template v-if="behind">{{ behind }} {{ behind === 1 ? 'site is' : 'sites are' }} behind.</template>
        <template v-else-if="data.latest">Every site with a status is on it.</template>
      </p>

      <div class="mt-5 flex flex-col gap-4">
        <section
          v-for="g in groups"
          :key="g.version ?? 'unknown'"
          class="rounded-xl border p-4 sm:p-5"
          :class="g.outdated ? 'border-warning/30 bg-warning/5' : 'border-default bg-default'"
        >
          <header class="flex flex-wrap items-center gap-2">
            <h2 class="font-mono text-lg font-semibold text-highlighted">{{ g.version ?? 'Unknown' }}</h2>
            <UBadge v-if="g.latest" label="newest" color="success" variant="soft" icon="i-lucide-check" />
            <UBadge v-else-if="g.outdated" label="behind" color="warning" variant="soft" icon="i-lucide-arrow-up-circle" />
            <span class="ml-auto text-sm text-muted">{{ g.sites.length }} {{ g.sites.length === 1 ? 'site' : 'sites' }}</span>
          </header>
          <p v-if="g.version == null" class="mt-1 text-sm text-muted">No status yet: add each site’s status token to see its version.</p>
          <ul class="mt-3 flex flex-wrap gap-2">
            <li v-for="s in g.sites" :key="s.id">
              <NuxtLink
                :to="`/sites/${s.id}`"
                class="inline-flex items-center gap-2 rounded-lg border border-default bg-default px-3 py-1.5 text-sm text-highlighted transition-colors hover:bg-elevated"
              >
                <StateDot :state="s.state" size="sm" />
                {{ s.name }}
                <span v-if="s.client" class="text-muted">· {{ s.client }}</span>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </AppPage>
</template>
