<script setup lang="ts">
import type { ScopeTraffic, ScopeTrafficSite, TrafficTotals } from '#keeper/types/traffic'

// The visits of every site in a workspace and team (or every workspace). Simple answers "which
// site needs me?": one sentence for all of them, then a card per site with its animal, its
// people, a mood in words and a warm line, the ones that need a look first. Detailed keeps the
// usual numbers: who is on them right now, the totals against the period before, one chart, the
// sites side by side (sortable, with their share), and the top lists. Today is read live from
// the sites every 30 s; days come from the totals Keeper keeps. The sites download as CSV, a
// day (or an hour) per column, in either view.
const props = defineProps<{
  workspace?: string
  team?: string
  /** Where a site's own page is. */
  siteLink: (s: ScopeTrafficSite) => string
  /** A line under a site's name (its workspace or team), or nothing. */
  siteLine?: (s: ScopeTrafficSite) => string
  /** Who "your sites" are, for the empty state. */
  scopeName: string
  /** Open on Detailed until the person picks (owners and admins). */
  detailedByDefault?: boolean
}>()
const now = useNow()

type Period = ScopeTraffic['period']
const period = ref<Period>('today')
const { data, status, refresh } = await useFetch<ScopeTraffic>('/api/traffic', {
  key: () => `scope-traffic-${props.workspace ?? '*'}-${props.team ?? 'all'}-${period.value}`,
  query: computed(() => ({ workspace: props.workspace, team: props.team, period: period.value })),
})
// Today is live: every 30 s. Days change once an hour at most, but who is on the sites now does too.
useLivePoll(refresh, 30_000)

// Nobody's site shares today yet (all on an older tinyzoo): start on 30 days instead.
watch(data, (d) => {
  if (d?.period === 'today' && d.sites.length && !d.at && period.value === 'today') period.value = '30'
}, { immediate: true })

const view = useTrafficView(() => props.detailedByDefault ?? false)
const simple = computed(() => view.value === 'simple')
const periods = computed(() => periodTabs(['today', '7', '30', '90'], simple.value))
const isToday = computed(() => data.value?.period === 'today')
const fmt = (n: number) => n.toLocaleString('en-GB')
function changePct(now: number, before: number): number | null {
  if (!before) return null
  return Math.round(((now - before) / before) * 100)
}
const against = computed(() => (isToday.value ? 'yesterday by now' : `the ${data.value?.period} days before`))
function change(now: number, before: number): string {
  const pct = changePct(now, before)
  if (pct == null) return now ? 'nothing to compare yet' : ''
  return pct === 0 ? `same as ${against.value}` : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} % on ${against.value}`
}
function seconds(t: TrafficTotals): number | null {
  return t.visits ? Math.round(t.engagedMs / t.visits / 1000) : null
}
function minutes(t: TrafficTotals): string {
  const s = seconds(t)
  if (s == null) return '—'
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}
const bounce = (t: TrafficTotals) => (t.visits ? Math.round((t.bounces / t.visits) * 100) : null)
const headline = computed(() => {
  const d = data.value
  if (!d) return []
  const t = d.totals, p = d.previous
  return [
    { label: 'Visitors', value: fmt(t.visitors), change: change(t.visitors, p.visitors) },
    { label: 'Pageviews', value: fmt(t.pageviews), change: change(t.pageviews, p.pageviews) },
    { label: 'Visits', value: fmt(t.visits), change: change(t.visits, p.visits) },
    { label: 'Time per visit', value: minutes(t), change: p.visits ? `${minutes(p)} ${isToday.value ? 'yesterday by now' : 'before'}` : '' },
  ]
})
type Point = { day: string; visitors: number; pageviews: number; partial?: boolean }
const series = computed<Point[]>(() => {
  const d = data.value
  if (!d) return []
  if (d.today && d.through && d.today.day > d.through && d.series.length) return [...d.series, { day: d.today.day, visitors: d.today.visitors, pageviews: d.today.pageviews, partial: true }]
  return d.series
})

// ── the sites, side by side ──
type SortKey = 'name' | 'visitors' | 'change' | 'pageviews' | 'visits' | 'time' | 'bounce' | 'active'
const sortKey = ref<SortKey>('visitors')
const sortDesc = ref(true)
function sortBy(key: SortKey) {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else {
    sortKey.value = key
    sortDesc.value = key !== 'name'
  }
}
const valueOf = (s: ScopeTrafficSite, key: SortKey): number | string => {
  switch (key) {
    case 'name': return s.name.toLowerCase()
    case 'visitors': return s.totals.visitors
    case 'change': return changePct(s.totals.visitors, s.previous.visitors) ?? -Infinity
    case 'pageviews': return s.totals.pageviews
    case 'visits': return s.totals.visits
    case 'time': return seconds(s.totals) ?? -1
    case 'bounce': return bounce(s.totals) ?? -1
    case 'active': return s.active ?? -1
  }
}
const rows = computed(() => {
  const list = [...(data.value?.sites ?? [])]
  const dir = sortDesc.value ? -1 : 1
  return list.sort((a, b) => {
    // Sites that do not count visits always go last.
    if (a.available !== b.available) return a.available ? -1 : 1
    const x = valueOf(a, sortKey.value), y = valueOf(b, sortKey.value)
    return (x < y ? -1 : x > y ? 1 : 0) * dir || a.name.localeCompare(b.name)
  })
})
const maxVisitors = computed(() => Math.max(1, ...(data.value?.sites ?? []).map((s) => s.totals.visitors)))
const share = (s: ScopeTrafficSite) => (data.value?.totals.visitors ? Math.round((s.totals.visitors / data.value.totals.visitors) * 100) : 0)
const columns = computed(() => [
  { key: 'name' as const, label: 'Site', align: 'left', cls: '' },
  ...(isToday.value || data.value?.active != null ? [{ key: 'active' as const, label: 'Now', align: 'right', cls: '' }] : []),
  { key: 'visitors' as const, label: 'Visitors', align: 'right', cls: '' },
  { key: 'change' as const, label: 'Change', align: 'right', cls: 'hidden sm:table-cell' },
  { key: 'pageviews' as const, label: 'Pageviews', align: 'right', cls: 'hidden md:table-cell' },
  { key: 'visits' as const, label: 'Visits', align: 'right', cls: 'hidden lg:table-cell' },
  { key: 'time' as const, label: 'Time / visit', align: 'right', cls: 'hidden lg:table-cell' },
  { key: 'bounce' as const, label: 'Bounce', align: 'right', cls: 'hidden xl:table-cell' },
])
const ariaSort = (key: SortKey) => (sortKey.value === key ? (sortDesc.value ? 'descending' : 'ascending') : 'none')
function changeLabel(s: ScopeTrafficSite) {
  const pct = changePct(s.totals.visitors, s.previous.visitors)
  if (pct == null) return s.totals.visitors ? 'new' : '—'
  return pct === 0 ? '0 %' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`
}
function changeTone(s: ScopeTrafficSite) {
  const pct = changePct(s.totals.visitors, s.previous.visitors)
  return pct == null || Math.abs(pct) < 5 ? 'text-muted' : pct > 0 ? 'text-success' : 'text-warning'
}
/** The site has numbers for this period (today needs its live answer). */
const counted = (s: ScopeTrafficSite) => s.available && !(isToday.value && s.error)
const notCounting = computed(() => (data.value?.sites ?? []).filter((s) => !s.available).length)
const needsUpdate = computed(() => (data.value?.sites ?? []).filter((s) => s.update))

// ── Simple: in words, a card per site ──
const words = computed(() => periodWords(data.value?.period ?? period.value))
const visitedWhen: Record<Period, string> = { 'today': 'today', '7': 'this week', '30': 'this month', '90': 'over the last 3 months' }
const moodOfSite = (s: ScopeTrafficSite) => moodOf(s.totals.visitors, s.previous.visitors, !!s.drop)
/** Worth a look: a drop Keeper told about, a lot fewer than before, or numbers that could not be read. */
const needsLook = (s: ScopeTrafficSite) => s.available && (!!s.drop || (s.error && !s.update) || (counted(s) && moodOfSite(s) === 'quiet'))
const cards = computed(() => [...(data.value?.sites ?? [])].sort((a, b) => {
  const rank = (s: ScopeTrafficSite) => (!s.available ? 2 : needsLook(s) ? 0 : 1)
  return rank(a) - rank(b) || (counted(b) ? b.totals.visitors : -1) - (counted(a) ? a.totals.visitors : -1) || a.name.localeCompare(b.name)
}))
/** "around 530": a usual level said roughly. */
const roughly = (n: number) => fmt(n < 100 ? n : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 50) * 50)
function cardLine(s: ScopeTrafficSite): string {
  if (!s.available) return 'Doesn’t count visits yet'
  if (!counted(s)) return s.update ? 'Shows today after an update to tinyzoo 1.6' : 'Couldn’t read its visits just now'
  const parts = [`${fmt(s.totals.visitors)} ${peopleWord(s.totals.visitors)}`]
  const mood = moodOfSite(s)
  // A drop is measured a day against the usual level, so it says so a day.
  if (s.drop) parts.push(isToday.value ? `usually around ${roughly(s.drop.baselinePerDay)} a day` : `about ${fmt(s.drop.perDay)} a day, usually ${roughly(s.drop.baselinePerDay)}`)
  else if ((mood === 'quiet' || mood === 'busy') && s.previous.visitors) parts.push(`usually around ${roughly(s.previous.visitors)}`)
  else if (s.active) parts.push(`${fmt(s.active)} here now`)
  return parts.join(' · ')
}
const quieter = computed(() => (data.value?.sites ?? []).filter((s) => counted(s) && moodOfSite(s) === 'quiet').map((s) => s.name))
const quieterLine = computed(() => {
  const q = quieter.value
  if (!q.length) return ''
  if (q.length === 1) return `${q[0]} is quieter than usual`
  if (q.length === 2) return `${q[0]} and ${q[1]} are quieter than usual`
  return `${q.length} sites are quieter than usual`
})
const updated = computed(() => `Updated ${updatedAgo(data.value?.at, now.value)}`)
const howItWorks = computed(() => `${isToday.value ? 'Today so far, read live from the sites every 30 seconds.' : 'Daily totals from each site’s own analytics, read about once an hour. The lists add up each site’s daily top 10.'} Visitors add up per site: someone on two sites counts twice.`)

// ── download ──
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function download() {
  const d = data.value
  if (!d) return
  const keys = d.series.map((p) => (d.hourly ? `${Number(p.day.slice(11))}:00` : p.day))
  const head = ['Site', 'Address', 'Workspace', 'Team', 'Visitors', 'Visitors before', 'Pageviews', 'Visits', 'Bounces', 'Seconds per visit', ...keys]
  const lines = rows.value.filter((s) => s.available).map((s) => [
    s.name, s.url, s.workspace.name, s.team.name, s.totals.visitors, s.previous.visitors, s.totals.pageviews, s.totals.visits,
    s.totals.bounces, seconds(s.totals) ?? '', ...keys.map((_, i) => s.spark[i] ?? 0),
  ])
  const csv = [head, ...lines].map((l) => l.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}\n`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `traffic-${(props.workspace ?? 'every-workspace')}${props.team && props.team !== 'all' ? `-${props.team}` : ''}-${d.period === 'today' ? d.through : `${d.period}-days-to-${d.through}`}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
const throughLabel = computed(() => (data.value?.through ? new Date(`${data.value.through}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <LiveNow v-if="!simple && data && data.active != null" :active="data.active" :today="isToday ? null : data.today?.visitors ?? null" where="on your sites" />
      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <UTabs v-model="period" :items="periods" :content="false" size="xs" variant="pill" color="neutral" class="w-auto" />
        <UButton v-if="!simple" icon="i-lucide-download" color="neutral" variant="ghost" size="xs" :disabled="!data?.sites.some((s) => s.available)" aria-label="Download as CSV" @click="download">
          <span class="hidden sm:inline">CSV</span>
        </UButton>
        <TrafficViewSwitch v-model="view" />
      </div>
    </div>

    <div v-if="status === 'pending' && !data" class="k-card flex flex-col gap-3 p-5">
      <USkeleton class="h-6 w-48" />
      <USkeleton class="h-40 w-full" />
    </div>

    <div v-else-if="!data?.sites.length" class="k-card p-5 text-sm">
      <p class="text-highlighted">No sites in {{ scopeName }} yet.</p>
      <p class="mt-0.5 text-muted">Their visits add up here once they are added and count visits.</p>
    </div>

    <template v-else-if="simple">
      <section aria-labelledby="visitors-heading">
        <h2 id="visitors-heading" class="font-display text-lg font-bold tracking-tight text-highlighted sm:text-xl">
          <span class="tabular">{{ fmt(data.totals.visitors) }}</span> {{ peopleWord(data.totals.visitors) }} visited your sites {{ visitedWhen[data.period] }}
        </h2>
        <p v-if="data.active != null || quieterLine" class="mt-1 flex flex-col items-start gap-x-1.5 gap-y-0.5 text-[0.8125rem] text-muted sm:flex-row sm:flex-wrap sm:items-center" aria-live="polite">
          <span v-if="data.active != null" class="inline-flex items-center gap-1.5 text-highlighted tabular">
            <span class="relative inline-flex size-2 shrink-0" aria-hidden="true">
              <span v-if="data.active" class="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
              <span class="relative inline-flex size-2 rounded-full" :class="data.active ? 'bg-success' : 'bg-(--ui-border-accented)'" />
            </span>
            {{ data.active ? `${fmt(data.active)} on them right now` : 'Nobody on them right now' }}
          </span>
          <span v-if="data.active != null && quieterLine" class="hidden sm:inline" aria-hidden="true">·</span>
          <span v-if="quieterLine">{{ quieterLine }}</span>
        </p>
        <p v-else-if="data.previous.visitors" class="mt-1 text-[0.8125rem] text-muted">{{ changeInWords(data.totals.visitors, data.previous.visitors, words.against) }}</p>

        <ul class="k-card mt-4 divide-y divide-default px-3 sm:px-4" aria-label="Sites">
          <li v-for="s in cards" :key="s.id" :class="s.available ? '' : 'opacity-60'">
            <NuxtLink :to="siteLink(s)" class="group -mx-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 hover:bg-(--k-visitors-hover) sm:-mx-4 sm:px-4">
              <SiteAnimal :id="s.id" size="sm" />
              <span class="min-w-0">
                <span class="flex min-w-0 items-baseline gap-2">
                  <span class="truncate font-display text-sm font-semibold text-highlighted group-hover:underline">{{ s.name }}</span>
                  <span v-if="siteLine?.(s)" class="hidden truncate text-xs text-dimmed sm:inline">{{ siteLine(s) }}</span>
                </span>
                <span class="block text-xs tabular" :class="s.available && !counted(s) && !s.update ? 'text-warning' : 'text-muted'" :title="s.error ?? undefined">{{ cardLine(s) }}</span>
              </span>
              <span v-if="counted(s)" class="flex flex-col items-end gap-1">
                <span class="k-mood" :class="{ 'k-mood--quiet': moodOfSite(s) === 'quiet', 'k-mood--busy': moodOfSite(s) === 'busy' }">{{ MOOD_LABELS[moodOfSite(s)] }}</span>
                <TrafficSparkline v-if="s.spark.length > 1" :values="s.spark" warm :width="72" :height="20" :label="`${s.name}: visitors ${isToday ? 'an hour today' : 'a day'}`" />
              </span>
              <span v-else />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section class="k-card p-4 sm:p-5" aria-label="What they read and how they found you">
        <div class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
          <TrafficList title="Most read" :items="data.pages" kind="page" :sites="data.sites.length > 1" />
          <TrafficList title="Found you through" :items="data.sources" kind="source" />
          <TrafficList title="Where they’re from" :items="data.countries" kind="country" />
          <TrafficList title="What they use" :items="data.devices" kind="device" />
        </div>
      </section>

      <div class="-mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <UTooltip :text="howItWorks" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'max-w-80 h-auto py-1.5 whitespace-normal' }">
          <span tabindex="0" class="cursor-help underline decoration-dotted decoration-(--ui-border-accented) underline-offset-4" :aria-label="`${updated}. ${howItWorks}`">{{ updated }}</span>
        </UTooltip>
        <span class="flex items-center gap-3">
          <button type="button" class="font-medium text-highlighted hover:underline" @click="view = 'detailed'">Show as table</button>
          <button type="button" class="font-medium text-highlighted hover:underline disabled:opacity-50" :disabled="!data.sites.some((s) => s.available)" @click="download">Download CSV</button>
        </span>
      </div>
    </template>

    <template v-else>
      <section class="k-card p-4 sm:p-5" aria-label="Totals">
        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div v-for="h in headline" :key="h.label" class="min-w-0">
            <dt class="text-xs text-muted">{{ h.label }}</dt>
            <dd class="font-display text-xl font-bold text-highlighted tabular sm:text-2xl">{{ h.value }}</dd>
            <dd class="text-xs text-muted tabular">{{ h.change }}</dd>
          </div>
        </dl>
        <TrafficChart v-if="series.length" :series="series" :hourly="isToday" class="mt-5" />
        <p v-else class="mt-5 text-sm text-muted">{{ isToday ? 'No site shares today yet.' : 'No days counted yet.' }}</p>
        <p class="mt-3 text-xs text-muted">
          <template v-if="isToday">Today so far on {{ data.sites.filter((s) => s.available && !s.error).length }} sites, read live {{ timeAgo(data.at, now) }} and every 30 seconds. </template>
          <template v-else>To {{ throughLabel }}<template v-if="series.at(-1)?.partial">, and today so far (dashed)</template>. Daily totals read {{ timeAgo(data.at, now) }}. </template>
          Visitors add up per site: someone on two sites counts twice.
        </p>
      </section>

      <section aria-labelledby="sites-heading">
        <h2 id="sites-heading" class="k-label mb-2">Sites</h2>
        <div class="k-card overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-xs text-muted">
                <th
                  v-for="c in columns" :key="c.key" scope="col" :aria-sort="ariaSort(c.key)"
                  :class="[c.cls, c.align === 'right' ? 'text-right' : 'text-left', c.key === 'name' ? 'pl-4 sm:pl-5' : '', 'px-2 py-2 font-medium']"
                >
                  <button type="button" class="inline-flex items-center gap-1 hover:text-highlighted" :class="sortKey === c.key ? 'text-highlighted' : ''" @click="sortBy(c.key)">
                    {{ c.label }}
                    <UIcon v-if="sortKey === c.key" :name="sortDesc ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'" class="size-3" />
                  </button>
                </th>
                <th scope="col" class="hidden px-2 py-2 pr-4 text-right font-medium sm:table-cell sm:pr-5">{{ isToday ? 'By hour' : 'By day' }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="s in rows" :key="s.id" class="align-middle" :class="s.available ? '' : 'text-muted'">
                <td class="w-2/5 max-w-0 py-2.5 pr-2 pl-4 sm:pl-5">
                  <NuxtLink :to="siteLink(s)" class="block truncate font-medium text-highlighted hover:underline">{{ s.name }}</NuxtLink>
                  <p v-if="!s.available" class="truncate text-xs">Does not count visits</p>
                  <p v-else-if="s.error" class="truncate text-xs text-warning" :title="s.error">{{ s.update ? 'Live today after an update to tinyzoo 1.6' : s.error }}</p>
                  <p v-else-if="siteLine?.(s)" class="truncate text-xs text-muted">{{ siteLine(s) }}</p>
                  <div v-if="counted(s)" class="mt-1 h-1 rounded-full bg-(--ui-bg-elevated)" :title="`${share(s)} % of all visitors`">
                    <div class="h-1 rounded-full bg-(--k-series-1)" :style="{ width: `${Math.max(s.totals.visitors ? 2 : 0, (s.totals.visitors / maxVisitors) * 100)}%` }" />
                  </div>
                </td>
                <td v-if="columns.some((c) => c.key === 'active')" class="px-2 py-2.5 text-right tabular">
                  <span v-if="s.active" class="inline-flex items-center gap-1.5 text-highlighted"><span class="size-1.5 rounded-full bg-success" />{{ fmt(s.active) }}</span>
                  <span v-else class="text-dimmed">{{ s.active === 0 ? '0' : '—' }}</span>
                </td>
                <td class="px-2 py-2.5 text-right font-medium text-highlighted tabular">{{ counted(s) ? fmt(s.totals.visitors) : '—' }}</td>
                <td class="hidden px-2 py-2.5 text-right tabular sm:table-cell" :class="changeTone(s)">{{ counted(s) ? changeLabel(s) : '—' }}</td>
                <td class="hidden px-2 py-2.5 text-right tabular md:table-cell">{{ counted(s) ? fmt(s.totals.pageviews) : '—' }}</td>
                <td class="hidden px-2 py-2.5 text-right tabular lg:table-cell">{{ counted(s) ? fmt(s.totals.visits) : '—' }}</td>
                <td class="hidden px-2 py-2.5 text-right tabular lg:table-cell">{{ counted(s) ? minutes(s.totals) : '—' }}</td>
                <td class="hidden px-2 py-2.5 text-right tabular xl:table-cell">{{ counted(s) && bounce(s.totals) != null ? `${bounce(s.totals)} %` : '—' }}</td>
                <td class="hidden py-2.5 pr-4 pl-2 sm:table-cell sm:pr-5">
                  <TrafficSparkline v-if="counted(s) && s.spark.length > 1" :values="s.spark" :label="`${s.name}: visitors ${isToday ? 'an hour today' : 'a day'}`" class="ml-auto" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="notCounting || needsUpdate.length" class="mt-2 text-xs text-muted">
          <template v-if="notCounting">{{ notCounting }} {{ notCounting === 1 ? 'site does' : 'sites do' }} not count visits (no analytics plugin). </template>
          <template v-if="needsUpdate.length">{{ needsUpdate.map((s) => s.name).join(', ') }} {{ needsUpdate.length === 1 ? 'shares' : 'share' }} today live after an update to tinyzoo 1.6.</template>
        </p>
      </section>

      <section class="k-card p-4 sm:p-5" aria-label="Top lists">
        <div class="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          <TrafficList title="Pages" :items="data.pages" kind="page" :sites="data.sites.length > 1" detailed />
          <TrafficList title="Sources" :items="data.sources" kind="source" detailed />
          <TrafficList title="Countries" :items="data.countries" kind="country" detailed />
          <TrafficList title="Devices" :items="data.devices" kind="device" detailed />
        </div>
        <p class="mt-4 text-xs text-muted">{{ isToday ? 'Each site’s top 10 today, added up.' : 'Each site’s daily top 10, added up.' }}</p>
      </section>
    </template>
  </div>
</template>
