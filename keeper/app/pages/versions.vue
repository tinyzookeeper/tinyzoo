<script setup lang="ts">
import type { OverviewResponse, SiteSummary } from '#keeper/types/keeper'

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
const known = computed(() => data.value.sites.filter((s) => s.version).length)
const behind = computed(() => groups.value.filter((g) => g.outdated).reduce((n, g) => n + g.sites.length, 0))
</script>

<template>
  <AppPage title="Versions" description="Which tinyzoo each site runs, the newest first.">
    <div v-if="status === 'pending' && !data.sites.length" class="flex flex-col gap-3">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-28 w-full" />
    </div>

    <div v-else-if="!data.sites.length" class="k-card">
      <KEmpty animal="owl" title="No sites yet" description="Once sites are added, here you see which tinyzoo each one runs.">
        <UButton to="/sites/new" label="Add a site" icon="i-lucide-plus" />
      </KEmpty>
    </div>

    <template v-else>
      <div class="k-moment mb-8 flex items-center gap-4 px-5 py-4">
        <span class="k-tile size-10 bg-(--k-surface)!"><UIcon :name="behind ? 'i-lucide-arrow-up-circle' : known ? 'i-lucide-check' : 'i-lucide-key-round'" class="size-5" :class="behind ? 'text-warning' : known ? 'text-success' : 'text-muted'" /></span>
        <p class="text-sm text-highlighted sm:text-[0.9375rem]">
          <template v-if="data.latest">The newest tinyzoo is <span class="font-mono font-medium">{{ data.latest }}</span>. </template>
          <template v-if="behind">{{ behind }} {{ behind === 1 ? 'site is' : 'sites are' }} behind it.</template>
          <template v-else-if="!known">None of the sites shows its version yet: that takes each site’s status token.</template>
          <template v-else-if="data.latest">Every site with a status runs it.</template>
        </p>
      </div>

      <div class="flex flex-col gap-8">
        <section v-for="g in groups" :key="g.version ?? 'unknown'">
          <h2 class="k-label mb-2 flex items-center gap-2">
            <span :class="g.version ? 'font-mono' : ''">{{ g.version ?? 'No status yet' }}</span>
            <UBadge v-if="g.latest" label="newest" color="success" variant="soft" size="sm" />
            <UBadge v-else-if="g.outdated" label="behind" color="warning" variant="soft" size="sm" />
            <span class="k-count">{{ g.sites.length }}</span>
          </h2>
          <ul class="k-card divide-y divide-(--ui-border-muted)">
            <li v-for="site in g.sites" :key="site.id" class="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/40">
              <SiteAnimal :id="site.id" :state="site.state" size="sm" />
              <div class="min-w-0 flex-1">
                <NuxtLink :to="`/sites/${site.id}`" class="block truncate text-sm font-medium text-highlighted after:absolute after:inset-0">{{ site.name }}</NuxtLink>
                <p class="truncate text-xs text-muted"><template v-if="site.client">{{ site.client }} · </template><span class="font-mono">{{ hostOf(site.url) }}</span></p>
              </div>
            </li>
          </ul>
          <p v-if="g.version == null" class="mt-2 text-xs text-muted">Add each site’s status token to see its version.</p>
        </section>
      </div>
    </template>
  </AppPage>
</template>
