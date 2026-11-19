<script setup lang="ts">
// The entry editor's "Visits" panel: views, visitors and the average time on this entry's pages
// (all its languages) over the last 30 days, their shape, and where the visits came from.
// Nothing for a collection without pages on the website, or for someone who may not read the
// analytics: the editor then leaves the panel out.
import { compactNumber, duration } from '../app/format'

const props = defineProps<{ entity: string; id: string; locale: string | null }>()
const { t, locale: uiLocale } = useCmsI18n()
const tx = (key: string, params?: Record<string, unknown>) => t(`plugins.analytics.${key}`, params as any)

interface EntryStats { tracked: boolean; days?: number; pageviews?: number; visitors?: number; avgEngagedMs?: number; series?: number[]; sources?: { value: string; visits: number }[] }
const { data } = useLazyFetch<EntryStats>('/api/cms/_p/analytics/entry', {
  query: computed(() => ({ entity: props.entity, id: props.id })),
  key: computed(() => `analytics-entry:${props.entity}:${props.id}`),
  server: false,
})
const sourceLabel = (v: string) => (v === 'Direct' || v === 'Other' ? tx(`source.${v}`) : v)
const more = computed(() => `/admin/p/analytics?period=30d&f.entry=${encodeURIComponent(`${props.entity}:${props.id}`)}`)
</script>

<template>
  <div v-if="data?.tracked" class="space-y-3">
    <template v-if="data.pageviews">
      <dl class="an-trio">
        <div class="min-w-0">
          <dt class="truncate text-xs text-muted">{{ tx('panel.views') }}</dt>
          <dd class="text-lg font-semibold text-highlighted">{{ compactNumber(data.pageviews, uiLocale) }}</dd>
        </div>
        <div class="min-w-0">
          <dt class="truncate text-xs text-muted">{{ tx('panel.visitors') }}</dt>
          <dd class="text-lg font-semibold text-highlighted">{{ compactNumber(data.visitors ?? 0, uiLocale) }}</dd>
        </div>
        <div class="min-w-0">
          <dt class="truncate text-xs text-muted">{{ tx('panel.avgTime') }}</dt>
          <dd class="text-lg font-semibold text-highlighted">{{ duration(data.avgEngagedMs ?? 0) }}</dd>
        </div>
      </dl>
      <div>
        <AnalyticsSparkline :values="data.series ?? []" :label="`${tx('panel.views')}, ${tx('panel.last30', { count: data.days })}: ${(data.series ?? []).join(', ')}`" :width="260" :height="40" class="w-full h-10" />
        <p class="mt-1 text-xs text-muted">{{ tx('panel.last30', { count: data.days }) }}</p>
      </div>
      <div v-if="data.sources?.length">
        <p class="mb-1 text-xs font-medium text-muted">{{ tx('panel.sources') }}</p>
        <ul class="space-y-0.5 text-sm">
          <li v-for="s in data.sources" :key="s.value" class="flex justify-between gap-2">
            <span class="truncate text-highlighted">{{ sourceLabel(s.value) }}</span>
            <span class="shrink-0 tabular-nums text-muted">{{ compactNumber(s.visits, uiLocale) }}</span>
          </li>
        </ul>
      </div>
      <UButton :to="more" size="xs" variant="link" color="neutral" class="px-0" trailing-icon="i-lucide-arrow-right" :label="tx('widget.open')" />
    </template>
    <p v-else class="text-sm text-muted">{{ tx('panel.none', { count: data.days }) }}</p>
  </div>
</template>

<style scoped>
/* Three numbers in a row (written here: a site's Tailwind scans tinyzoo's app/ only). */
.an-trio { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
</style>
