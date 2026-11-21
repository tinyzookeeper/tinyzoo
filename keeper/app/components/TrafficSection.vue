<script setup lang="ts">
import type { SiteLive, TrafficItem, TrafficReport, TrafficTotals } from '#keeper/types/traffic'

// A site's visits, from its analytics plugin. Today is read live from the site (every 30 s
// while the page is open): who is on it now, today so far by hour, against yesterday up to
// the same time. A week, a month or 3 months (7, 30, 90 days) come from the daily totals Keeper
// keeps, with today so far as a dashed last point.
//
// Two depths of one set of numbers: Simple says it in words (how many people, how that compares,
// one warm line, what they read and how they found the site); Detailed keeps the usual numbers
// (visitors, pageviews, visits, time per visit, change in %, the days as a table). A drop in
// visitors shows in both, as a calm note with something to do. Calm when there is nothing to
// show yet, or the site could not be read.
const props = defineProps<{
  siteId: string
  /** The person may check the site (not a guest): the drop note offers it. */
  canCheck?: boolean
  checking?: boolean
  /** The site's address, for a guest's "Open the site". */
  siteUrl?: string
}>()
const emit = defineEmits<{ check: [] }>()
const now = useNow()
const { isManager } = useScope()
const view = useTrafficView(isManager)
const simple = computed(() => view.value === 'simple')

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

const periods = computed(() => periodTabs([...(hasLive.value ? ['today' as const] : []), '7', '30', '90'], simple.value))
const words = computed(() => periodWords(period.value))

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
/** The period's totals and the ones they are compared with. */
const pair = computed<{ now: TrafficTotals; before: TrafficTotals } | null>(() => {
  if (isToday.value) return { now: live.value!.totals, before: live.value!.yesterdaySoFar }
  return report.value ? { now: report.value.totals, before: report.value.previous } : null
})
const headline = computed(() => {
  const p = pair.value
  if (!p) return []
  return isToday.value ? headlineOf(p.now, p.before, 'yesterday by now', 'yesterday by now') : headlineOf(p.now, p.before, `the ${days.value} days before`, 'before')
})
/** Simple: "About a fifth fewer than last month". */
const inWords = computed(() => (pair.value ? changeInWords(pair.value.now.visitors, pair.value.before.visitors, words.value.against) : ''))
/** Simple: "3 here now, 38 today", or "3 here now" on Today. */
const hereNow = computed(() => {
  const l = live.value
  if (!l?.at) return ''
  const here = l.active ? `${fmt(l.active)} here now` : 'Nobody here now'
  return isToday.value ? here : `${here}, ${fmt(l.totals.visitors)} today`
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

// ── Simple's footer ──
const readAt = computed(() => (isToday.value ? live.value!.at : report.value?.checkedAt ?? null))
const updated = computed(() => (!isToday.value && report.value?.error ? 'The last update did not work' : `Updated ${updatedAgo(readAt.value, now.value)}`))
const howItWorks = computed(() => {
  const parts = isToday.value
    ? ['Today so far, read live from the site every 30 seconds. The day’s final numbers come the morning after.']
    : ['Daily totals from the site’s own analytics, read about once an hour. The lists add up each day’s top 10.']
  if (!isToday.value && report.value?.error) parts.push(`The last read did not work: ${report.value.error}`)
  if (live.value?.update && live.value.error) parts.push(live.value.error)
  return parts.join(' ')
})
/** "Show as table": the Detailed view, with the days (or hours) open. */
const tableOpen = ref(false)
const table = ref<HTMLDetailsElement | null>(null)
async function showTable() {
  view.value = 'detailed'
  tableOpen.value = true
  await nextTick()
  table.value?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  table.value?.querySelector('summary')?.focus()
}
</script>

<template>
  <section id="traffic" class="flex min-w-0 scroll-mt-20 flex-col" aria-labelledby="traffic-heading">
    <header class="mb-2 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-2">
      <h2 id="traffic-heading" class="k-label">Visitors</h2>
      <template v-if="!simple">
        <span v-if="isToday" class="text-xs text-muted">live</span>
        <span v-else-if="hasDays" class="text-xs text-muted">to {{ throughLabel }}<template v-if="series.at(-1)?.partial"> and today so far</template></span>
      </template>
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <UTabs v-if="hasDays || hasLive" v-model="period" :items="periods" :content="false" size="xs" variant="pill" color="neutral" class="w-auto" />
        <TrafficViewSwitch v-model="view" />
      </div>
    </header>

    <TrafficDropNote v-if="report?.drop" :drop="report.drop" :can-check="canCheck" :checking="checking" :site-url="siteUrl" class="mb-3" @check="emit('check')" />

    <div class="k-card p-4 sm:p-5">
      <div v-if="status === 'pending' && !report && !hasLive" class="flex flex-col gap-3">
        <USkeleton class="h-6 w-48" />
        <USkeleton class="h-40 w-full" />
      </div>

      <!-- Simple: in words, one warm line. -->
      <template v-else-if="(isToday || (report && hasDays)) && simple">
        <p class="flex flex-wrap items-baseline gap-x-2">
          <span class="font-display text-[1.875rem] leading-none font-extrabold tracking-tight text-highlighted tabular">{{ fmt(pair?.now.visitors ?? 0) }}</span>
          <span class="font-display text-sm font-semibold text-muted">{{ peopleWord(pair?.now.visitors ?? 0) }} {{ words.now }}</span>
        </p>
        <p class="mt-2 flex flex-col items-start gap-x-1.5 gap-y-0.5 text-[0.8125rem] text-muted sm:flex-row sm:flex-wrap sm:items-center" aria-live="polite">
          <span v-if="inWords">{{ inWords }}</span>
          <template v-if="hereNow">
            <span v-if="inWords" class="hidden sm:inline" aria-hidden="true">·</span>
            <span class="inline-flex items-center gap-1.5 text-highlighted tabular">
              <span class="relative inline-flex size-2 shrink-0" aria-hidden="true">
                <span v-if="live?.active" class="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                <span class="relative inline-flex size-2 rounded-full" :class="live?.active ? 'bg-success' : 'bg-(--ui-border-accented)'" />
              </span>
              {{ hereNow }}
            </span>
          </template>
        </p>

        <VisitorsChart
          :series="isToday ? hourly : series" :hourly="isToday"
          :before="isToday ? undefined : report?.previousSeries" :before-label="words.against"
          class="mt-4"
        />

        <div class="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          <TrafficList title="Most read" :items="lists.pages" kind="page" />
          <TrafficList title="Found you through" :items="lists.sources" kind="source" />
          <TrafficList title="Where they’re from" :items="lists.countries" kind="country" />
          <TrafficList title="What they use" :items="lists.devices" kind="device" />
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <UTooltip :text="howItWorks" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'max-w-80 h-auto py-1.5 whitespace-normal' }">
            <span tabindex="0" class="cursor-help underline decoration-dotted decoration-(--ui-border-accented) underline-offset-4" :aria-label="`${updated}. ${howItWorks}`">{{ updated }}</span>
          </UTooltip>
          <button type="button" class="font-medium text-highlighted hover:underline" @click="showTable">Show as table</button>
        </div>
      </template>

      <!-- Detailed: the usual numbers. -->
      <template v-else-if="isToday || (report && hasDays)">
        <LiveNow v-if="hasLive" :active="live!.active" :today="isToday ? null : live!.totals.visitors" class="mb-4" />

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div v-for="h in headline" :key="h.label" class="min-w-0">
            <dt class="text-xs text-muted">{{ h.label }}</dt>
            <dd class="font-display text-xl font-bold text-highlighted tabular sm:text-2xl">{{ h.value }}</dd>
            <dd class="text-xs text-muted tabular">{{ h.change }}</dd>
          </div>
        </dl>

        <TrafficChart :series="isToday ? hourly : series" :hourly="isToday" class="mt-5" />
        <details ref="table" :open="tableOpen" class="mt-2 text-sm" @toggle="tableOpen = ($event.target as HTMLDetailsElement).open">
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
          <TrafficList title="Pages" :items="lists.pages" kind="page" detailed />
          <TrafficList title="Sources" :items="lists.sources" kind="source" detailed />
          <TrafficList title="Countries" :items="lists.countries" kind="country" detailed />
          <TrafficList title="Devices" :items="lists.devices" kind="device" detailed />
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
        <p class="mt-0.5 text-muted">{{ report?.error ?? 'Keeper reads the site’s daily totals about once an hour. A day’s totals are ready the morning after.' }}</p>
      </div>
    </div>
  </section>
</template>
