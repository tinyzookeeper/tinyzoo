<script setup lang="ts">
import type { SiteLive, TrafficItem, TrafficReport, TrafficTotals } from '#keeper/types/traffic'

// A site's visits, from its analytics plugin. Today is read live from the site (every 30 s
// while the page is open): who is on it now, today so far by hour, against yesterday up to
// the same time. 7, 30 or 90 days come from the daily totals Keeper keeps, with today so far
// as a dashed last point. Calm when there is nothing to show yet, or the site could not be read.
const props = defineProps<{ siteId: string }>()
const now = useNow()

type Period = 'today' | '7' | '30' | '90'
const { data: live, refresh: refreshLive } = await useFetch<SiteLive>(() => `/api/sites/${props.siteId}/live`, {
  key: () => `live-${props.siteId}`,
})
const hasLive = computed(() => !!live.value?.at)
const period = ref<Period>(hasLive.value ? 'today' : '30')
const days = computed(() => (period.value === 'today' ? '30' : period.value))
const { data: report, status } = await useFetch<TrafficReport>(() => `/api/sites/${props.siteId}/traffic`, {
  key: () => `traffic-${props.siteId}-${days.value}`,
  query: { days },
})
useLivePoll(refreshLive, 30_000, () => hasLive.value || !live.value?.update)

const periods = computed(() => [
  ...(hasLive.value ? [{ label: 'Today', value: 'today' }] : []),
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
])

const fmt = (n: number) => n.toLocaleString('en-GB')
function change(now: number, before: number, against: string): string {
  if (!before) return now ? 'nothing to compare yet' : ''
  const pct = Math.round(((now - before) / before) * 100)
  return pct === 0 ? `same as ${against}` : pct > 0 ? `+${pct} % on ${against}` : `−${Math.abs(pct)} % on ${against}`
}
function minutes(t: TrafficTotals): string {
  if (!t.visits) return '—'
  const s = Math.round(t.engagedMs / t.visits / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}
function headlineOf(t: TrafficTotals, p: TrafficTotals, against: string, timeAgainst: string) {
  return [
    { label: 'Visitors', value: fmt(t.visitors), change: change(t.visitors, p.visitors, against) },
    { label: 'Pageviews', value: fmt(t.pageviews), change: change(t.pageviews, p.pageviews, against) },
    { label: 'Visits', value: fmt(t.visits), change: change(t.visits, p.visits, against) },
    { label: 'Time per visit', value: minutes(t), change: p.visits ? `${minutes(p)} ${timeAgainst}` : '' },
  ]
}

const isToday = computed(() => period.value === 'today' && hasLive.value)
const headline = computed(() => {
  if (isToday.value) return headlineOf(live.value!.totals, live.value!.yesterdaySoFar, 'yesterday by now', 'yesterday by now')
  const r = report.value
  return r ? headlineOf(r.totals, r.previous, `the ${days.value} days before`, 'before') : []
})
const hourly = computed(() => {
  const l = live.value
  if (!l?.at || l.hour == null) return []
  return Array.from({ length: l.hour + 1 }, (_, h) => {
    const x = l.hours.find((p) => p.hour === h)
    return { day: `${l.day}T${String(h).padStart(2, '0')}`, visitors: x?.visitors ?? 0, pageviews: x?.pageviews ?? 0 }
  })
})
/** The days, and today so far as a dashed last point when the site shares it. */
type Point = { day: string; visitors: number; pageviews: number; partial?: boolean }
const series = computed<Point[]>(() => {
  const r = report.value
  if (!r) return []
  const l = live.value
  if (!l?.at || !l.day || !r.through || l.day <= r.through) return r.series
  return [...r.series, { day: l.day, visitors: l.totals.visitors, pageviews: l.totals.pageviews, partial: true }]
})
const lists = computed<Record<'pages' | 'sources' | 'countries' | 'devices', TrafficItem[]>>(() => {
  const src = isToday.value ? live.value! : report.value
  return { pages: src?.pages ?? [], sources: src?.sources ?? [], countries: src?.countries ?? [], devices: src?.devices ?? [] }
})
const hasDays = computed(() => !!report.value?.through)
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const throughLabel = computed(() => (report.value?.through ? new Date(`${report.value.through}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''))
const tableRows = computed(() => (isToday.value ? [...hourly.value].reverse().map((p) => ({ key: p.day, label: `${Number(p.day.slice(11))}:00`, ...p })) : [...series.value].reverse().map((p) => ({ key: p.day, label: p.partial ? 'Today so far' : dayLabel(p.day), ...p }))))
</script>

<template>
  <section id="traffic" class="flex min-w-0 scroll-mt-20 flex-col">
    <header class="mb-2 flex min-h-6 flex-wrap items-center gap-2">
      <h2 class="k-label">Traffic</h2>
      <span v-if="isToday" class="text-xs text-muted">live</span>
      <span v-else-if="hasDays" class="text-xs text-muted">to {{ throughLabel }}<template v-if="series.at(-1)?.partial"> and today so far</template></span>
      <UTabs v-if="hasDays || hasLive" v-model="period" :items="periods" :content="false" size="xs" variant="pill" color="neutral" class="ml-auto w-auto" />
    </header>
    <div class="k-card p-4 sm:p-5">
      <div v-if="status === 'pending' && !report && !hasLive" class="flex flex-col gap-3">
        <USkeleton class="h-6 w-48" />
        <USkeleton class="h-40 w-full" />
      </div>

      <template v-else-if="isToday || (report && hasDays)">
        <p v-if="report?.drop" class="mb-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-highlighted">
          <UIcon name="i-lucide-trending-down" class="mr-1 size-4 align-[-3px] text-warning" />
          Visitors fell to {{ report.drop.perDay }} a day, from {{ report.drop.baselinePerDay }} usually. A deploy that broke pages or the tracker, counting switched off, or lost search places are the usual causes.
        </p>

        <LiveNow v-if="hasLive" :active="live!.active" :today="isToday ? null : live!.totals.visitors" class="mb-4" />

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div v-for="h in headline" :key="h.label" class="min-w-0">
            <dt class="text-xs text-muted">{{ h.label }}</dt>
            <dd class="font-display text-xl font-bold text-highlighted tabular sm:text-2xl">{{ h.value }}</dd>
            <dd class="text-xs text-muted tabular">{{ h.change }}</dd>
          </div>
        </dl>

        <TrafficChart :series="isToday ? hourly : series" :hourly="isToday" class="mt-5" />
        <details class="mt-2 text-sm">
          <summary class="text-xs text-muted">{{ isToday ? 'The hours as a table' : 'The days as a table' }}</summary>
          <div class="mt-2 max-h-64 overflow-y-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left text-xs text-muted"><th class="pb-1 font-medium">{{ isToday ? 'Hour' : 'Day' }}</th><th class="pb-1 text-right font-medium">Visitors</th><th class="pb-1 text-right font-medium">Pageviews</th></tr></thead>
              <tbody class="divide-y divide-default">
                <tr v-for="p in tableRows" :key="p.key">
                  <td class="py-1 text-toned">{{ p.label }}</td>
                  <td class="py-1 text-right tabular">{{ fmt(p.visitors) }}</td>
                  <td class="py-1 text-right tabular">{{ fmt(p.pageviews) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        <div class="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          <TrafficList title="Pages" :items="lists.pages" kind="page" />
          <TrafficList title="Sources" :items="lists.sources" />
          <TrafficList title="Countries" :items="lists.countries" kind="country" />
          <TrafficList title="Devices" :items="lists.devices" />
        </div>
        <p v-if="isToday" class="mt-4 text-xs text-muted">
          Today so far, read live from the site {{ timeAgo(live!.at, now) }} and again every 30 seconds. The day’s final numbers come the morning after.
        </p>
        <p v-else class="mt-4 text-xs text-muted">
          Daily totals from the site’s own analytics, read {{ timeAgo(report!.checkedAt, now) }}. Lists add up each day’s top 10.
          <template v-if="report!.error"> The last read did not work: {{ report!.error }}</template>
          <template v-if="live?.update"> {{ live.error }}</template>
        </p>
      </template>

      <div v-else class="text-sm">
        <p class="text-highlighted">{{ report?.error ? 'No visits to show yet.' : 'The first visits show here within the hour.' }}</p>
        <p class="mt-0.5 text-muted">{{ report?.error ?? 'Keeper reads the site’s daily totals about once an hour; a day’s totals are ready the morning after.' }}</p>
      </div>
    </div>
  </section>
</template>
