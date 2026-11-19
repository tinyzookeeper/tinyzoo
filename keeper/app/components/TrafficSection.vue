<script setup lang="ts">
import type { TrafficReport, TrafficTotals } from '#keeper/types/traffic'

// A site's visits, from its analytics plugin: visitors and pageviews a day over 30 or 90 days,
// the headline numbers against the days before, and the top pages, sources, countries and
// devices. Calm when there is nothing to show yet, or the site could not be read.
const props = defineProps<{ siteId: string }>()
const now = useNow()

const days = ref<'30' | '90'>('30')
const { data: report, status } = await useFetch<TrafficReport>(() => `/api/sites/${props.siteId}/traffic`, {
  key: () => `traffic-${props.siteId}-${days.value}`,
  query: { days },
})

const periods = [{ label: '30 days', value: '30' }, { label: '90 days', value: '90' }]

const fmt = (n: number) => n.toLocaleString('en-GB')
function change(now: number, before: number): string {
  if (!before) return now ? 'nothing to compare yet' : ''
  const pct = Math.round(((now - before) / before) * 100)
  return pct === 0 ? 'same as before' : pct > 0 ? `+${pct} % on the ${days.value} days before` : `−${Math.abs(pct)} % on the ${days.value} days before`
}
function minutes(t: TrafficTotals): string {
  if (!t.visits) return '—'
  const s = Math.round(t.engagedMs / t.visits / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}
const headline = computed(() => {
  const r = report.value
  if (!r) return []
  const t = r.totals, p = r.previous
  return [
    { label: 'Visitors', value: fmt(t.visitors), change: change(t.visitors, p.visitors) },
    { label: 'Pageviews', value: fmt(t.pageviews), change: change(t.pageviews, p.pageviews) },
    { label: 'Visits', value: fmt(t.visits), change: change(t.visits, p.visits) },
    { label: 'Time per visit', value: minutes(t), change: p.visits ? `${minutes(p)} before` : '' },
  ]
})
const hasDays = computed(() => !!report.value?.through)
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const throughLabel = computed(() => (report.value?.through ? new Date(`${report.value.through}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''))
</script>

<template>
  <section id="traffic" class="flex min-w-0 scroll-mt-20 flex-col">
    <header class="mb-2 flex min-h-6 flex-wrap items-center gap-2">
      <h2 class="k-label">Traffic</h2>
      <span v-if="hasDays" class="text-xs text-muted">to {{ throughLabel }}</span>
      <UTabs v-if="hasDays" v-model="days" :items="periods" :content="false" size="xs" variant="pill" color="neutral" class="ml-auto w-auto" />
    </header>
    <div class="k-card p-4 sm:p-5">
      <div v-if="status === 'pending' && !report" class="flex flex-col gap-3">
        <USkeleton class="h-6 w-48" />
        <USkeleton class="h-40 w-full" />
      </div>

      <template v-else-if="report && hasDays">
        <p v-if="report.drop" class="mb-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-highlighted">
          <UIcon name="i-lucide-trending-down" class="mr-1 size-4 align-[-3px] text-warning" />
          Visitors fell to {{ report.drop.perDay }} a day, from {{ report.drop.baselinePerDay }} usually. A deploy that broke pages or the tracker, counting switched off, or lost search places are the usual causes.
        </p>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div v-for="h in headline" :key="h.label" class="min-w-0">
            <dt class="text-xs text-muted">{{ h.label }}</dt>
            <dd class="font-display text-xl font-bold text-highlighted tabular sm:text-2xl">{{ h.value }}</dd>
            <dd class="text-xs text-muted tabular">{{ h.change }}</dd>
          </div>
        </dl>

        <TrafficChart :series="report.series" class="mt-5" />
        <details class="mt-2 text-sm">
          <summary class="text-xs text-muted">The days as a table</summary>
          <div class="mt-2 max-h-64 overflow-y-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left text-xs text-muted"><th class="pb-1 font-medium">Day</th><th class="pb-1 text-right font-medium">Visitors</th><th class="pb-1 text-right font-medium">Pageviews</th></tr></thead>
              <tbody class="divide-y divide-default">
                <tr v-for="p in [...report.series].reverse()" :key="p.day">
                  <td class="py-1 text-toned">{{ dayLabel(p.day) }}</td>
                  <td class="py-1 text-right tabular">{{ fmt(p.visitors) }}</td>
                  <td class="py-1 text-right tabular">{{ fmt(p.pageviews) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        <div class="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          <TrafficList title="Pages" :items="report.pages" kind="page" />
          <TrafficList title="Sources" :items="report.sources" />
          <TrafficList title="Countries" :items="report.countries" kind="country" />
          <TrafficList title="Devices" :items="report.devices" />
        </div>
        <p class="mt-4 text-xs text-muted">
          Daily totals from the site’s own analytics, read {{ timeAgo(report.checkedAt, now) }}. Lists add up each day’s top 10.
          <template v-if="report.error"> The last read did not work: {{ report.error }}</template>
        </p>
      </template>

      <div v-else class="text-sm">
        <p class="text-highlighted">{{ report?.error ? 'No visits to show yet.' : 'The first visits show here within the hour.' }}</p>
        <p class="mt-0.5 text-muted">{{ report?.error ?? 'Keeper reads the site’s daily totals about once an hour; a day’s totals are ready the morning after.' }}</p>
      </div>
    </div>
  </section>
</template>
