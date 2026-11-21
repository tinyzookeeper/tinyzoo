<script setup lang="ts">
// The Visitors page (/admin/p/analytics), in two depths of the same numbers:
// - Simple (the default): the story first. One number and a few sentences in plain words on a
//   cream moment ("1 284 people visited the website in the last 7 days. That's 179 more than the
//   7 days before."), visitors as one warm line, three numbers said the way a person would ("4 in
//   10 leave after one page"), and the lists as questions ("What do they read?").
// - Detailed: the usual terms (unique visitors, pageviews, bounce rate…), both lines, every list
//   and tab, the comparison as a switch.
// Each person's choice is kept in a cookie. A click on any row filters the whole page by it; the
// period, the comparison and the filters live in the address, so a view can be shared and comes
// back on reload.
import { compactNumber, countryName, decimal, duration, flag, percent } from '../app/format'
import { type Dimension, type Filter, filtersQuery, parseFilters } from '../core/dimensions'
import { PERIODS, type Period, isPeriod } from '../core/range'
import { change } from '../core/rollup'
import type { BarItem, ChartPoint } from '../app/types'

definePageMeta({ layout: 'admin' })
const { t, locale, formatDateWith, languageName } = useCmsI18n()
const route = useRoute()
const router = useRouter()
const animals = useCmsAnimals()
const tx = (key: string, params?: Record<string, unknown>) => t(`plugins.analytics.${key}`, params as any)
useHead({ title: () => tx('title') })

// ── how much to show: each person's own choice ─────────────────────────────────
const viewCookie = useCookie<string | null>('cms_analytics_view', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })
const detailed = computed(() => viewCookie.value === 'detailed')
const setView = (v: 'simple' | 'detailed') => { viewCookie.value = v }

// ── the state in the address ─────────────────────────────────────────────────────
const period = computed<Period>(() => (isPeriod(route.query.period) ? route.query.period : '7d'))
// The simple view always compares (and says it in words); the switch is the detailed view's.
const compare = computed(() => !detailed.value || route.query.compare !== '0')
const filters = computed<Filter[]>(() => parseFilters(route.query as Record<string, unknown>))

function setQuery(patch: Record<string, string | undefined>) {
  const query: Record<string, any> = { ...route.query, ...patch }
  for (const k of Object.keys(query)) if (query[k] === undefined || query[k] === '') delete query[k]
  router.replace({ query })
}
const setPeriod = (p: Period) => setQuery({ period: p === '7d' ? undefined : p, ...(p === 'custom' ? { from: customFrom.value, to: customTo.value } : { from: undefined, to: undefined }) })
const addFilter = (dimension: Dimension, value: string) => setQuery({ [`f.${dimension}`]: value })
const removeFilter = (dimension: Dimension) => setQuery({ [`f.${dimension}`]: undefined })
const clearFilters = () => setQuery(Object.fromEntries(filters.value.map((f) => [`f.${f.dimension}`, undefined])))

const customFrom = ref(String(route.query.from ?? ''))
const customTo = ref(String(route.query.to ?? ''))
const applyCustom = () => setQuery({ period: 'custom', from: customFrom.value, to: customTo.value })

const periodItems = computed(() => PERIODS.map((p) => ({ label: tx(`period.${p}`), value: p })))
// The simple view's chips: the usual periods, the rest under "More".
const CHIPS: Period[] = ['today', '7d', '30d', 'month', '12m']
const chips = computed(() => (CHIPS.includes(period.value) ? CHIPS : [...CHIPS, period.value]))
// On a phone the chips swipe (Embla); the chosen one is scrolled into view.
const chipsRow = useTemplateRef<{ emblaApi?: { scrollTo: (i: number) => void } }>('chipsRow')
watch([period, chipsRow], () => nextTick(() => chipsRow.value?.emblaApi?.scrollTo(Math.max(0, chips.value.indexOf(period.value)))), { immediate: true })
const morePeriods = computed(() => [PERIODS.filter((p) => !CHIPS.includes(p)).map((p) => ({ label: tx(`period.${p}`), onSelect: () => setPeriod(p) }))])

// ── the numbers ────────────────────────────────────────────────────────────────
interface Item { value: string; visitors: number; visits: number; pageviews: number; entity?: string; id?: string; title?: string }
interface Totals { visitors: number; visits: number; pageviews: number; bounces: number; engagedMs: number; viewsPerVisit: number; bounceRate: number; avgEngagedMs: number }
interface Stats {
  range: { period: Period; from: string; to: string; bucket: 'hour' | 'day'; days: number }
  previous: { from: string; to: string } | null
  today: string
  keepRawDays: number
  partial: boolean
  collecting: { on: boolean; server: boolean; settings: boolean; canSwitch: boolean }
  totals: Totals
  previousTotals: Totals | null
  series: { key: string; visitors: number; pageviews: number }[]
  previousSeries: { key: string; visitors: number; pageviews: number }[] | null
  lists: Record<Dimension, Item[]>
  mode: 'cookieless' | 'consent' | 'strict'
  /** Among visitors who allowed statistics (`mode: 'consent'` only). */
  consent: any | null
}
const query = computed(() => ({
  period: period.value,
  ...(period.value === 'custom' ? { from: route.query.from, to: route.query.to } : {}),
  compare: compare.value ? '1' : '0',
  ...filtersQuery(filters.value),
}))
const { data, error, pending, refresh } = await useFetch<Stats>('/api/cms/_p/analytics/stats', { query })
// While new numbers load, the page keeps the last ones (dimmed) rather than jumping.
const stats = ref<Stats | null>(data.value ?? null)
watch(data, (d) => { if (d) stats.value = d })
const noAccess = computed(() => error.value?.statusCode === 403)

// "On the website now": asked again every 30 seconds while the page is open.
const active = ref<number | null>(null)
async function loadActive() {
  try { active.value = (await $fetch<{ active: number }>('/api/cms/_p/analytics/live')).active }
  catch { /* keeps the last number */ }
}
let liveTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void loadActive()
  liveTimer = setInterval(loadActive, 30_000)
})
onBeforeUnmount(() => clearInterval(liveTimer))

const fmt = (n: number) => compactNumber(n, locale.value)
const pointLabel = (key: string, bucket: 'hour' | 'day', long = false) => (bucket === 'hour'
  ? `${key.padStart(2, '0')}:00`
  : formatDateWith(`${key}T12:00:00`, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' }))

// ── simple: the story ──────────────────────────────────────────────────────────
const story = computed(() => {
  const s = stats.value
  if (!s) return null
  const n = s.totals.visitors
  const lines: string[] = []
  const before = s.previousTotals?.visitors
  if (before) {
    const diff = n - before
    const params = { count: fmt(Math.abs(diff)), before: tx(`story.before.${period.value}`) }
    lines.push(Math.abs(diff) / before < 0.03 ? tx('story.same', params) : tx(diff > 0 ? 'story.more' : 'story.fewer', params))
  }
  // The busiest day (or hour), when there is a shape to speak of.
  const series = s.series
  const top = series.reduce<typeof series[number] | null>((m, p) => (!m || p.visitors > m.visitors ? p : m), null)
  if (top && series.length >= 3 && top.visitors > 0 && series.some((p) => p.visitors !== top.visitors)) {
    lines.push(s.range.bucket === 'hour'
      ? tx('story.busiestHour', { hour: pointLabel(top.key, 'hour') })
      : tx('story.busiestDay', { day: pointLabel(top.key, 'day', true) }))
  }
  const source = s.lists.source?.[0]
  if (source && source.value !== 'Other') lines.push(source.value === 'Direct' ? tx('story.topSourceDirect') : tx('story.topSource', { source: source.value }))
  const page = s.lists.page?.[0]
  if (page) lines.push(tx('story.topPage', { page: page.title || page.value }))
  return {
    number: fmt(n),
    headline: tx('story.headline', { count: n, when: tx(`story.when.${period.value}`) }),
    lines,
  }
})
const liveText = computed(() => (active.value === null ? null : active.value ? tx('story.live', { count: active.value }) : tx('story.liveNone')))

// Three numbers said the way a person would, the usual term and value in their tooltip.
function said(now: number, before: number | undefined, up: string, down: string): string | null {
  if (before === undefined) return null
  const c = change(now, before)
  if (c === null) return null
  return Math.abs(c) < 0.05 ? tx('plain.same') : tx(c > 0 ? up : down)
}
const plain = computed(() => {
  const s = stats.value
  if (!s) return []
  const n = s.totals
  const p = s.previousTotals ?? undefined
  const pages = Math.max(1, Math.round(n.viewsPerVisit))
  return [
    { key: 'time', value: duration(n.avgEngagedMs), label: tx('plain.time'), change: said(n.avgEngagedMs, p?.avgEngagedMs, 'plain.timeUp', 'plain.timeDown'), term: `${tx('metric.avgEngaged')}: ${duration(n.avgEngagedMs)}` },
    { key: 'pages', value: tx('plain.pagesValue', { count: pages }), label: tx('plain.pages'), change: said(n.viewsPerVisit, p?.viewsPerVisit, 'plain.up', 'plain.down'), term: `${tx('metric.viewsPerVisit')}: ${decimal(n.viewsPerVisit, locale.value)}` },
    { key: 'bounce', value: tx('plain.bounceValue', { count: Math.round(n.bounceRate * 10) }), label: tx('plain.bounce'), change: said(n.bounceRate, p?.bounceRate, 'plain.up', 'plain.down'), term: `${tx('metric.bounceRate')}: ${percent(n.bounceRate, locale.value)}` },
  ]
})

// "What do they use?": phones, computers and tablets as shares of one bar.
const devices = computed(() => {
  const list = stats.value?.lists?.device ?? []
  const total = list.reduce((a, i) => a + i.visitors, 0) || 1
  const tones = ['var(--cms-an-visitors)', 'var(--an-device-2)', 'var(--an-device-3)']
  return list.slice(0, 3).map((i, k) => ({ key: i.value, label: labelOf('device', i.value).label, share: i.visitors / total, tone: tones[k]! }))
})

// ── detailed: the headline numbers ─────────────────────────────────────────────
type Tile = { key: string; label: string; value: string; hint?: string; delta?: { text: string; short: string } | null }
function delta(now: number, before: number | undefined): Tile['delta'] {
  if (before === undefined) return null
  const c = change(now, before)
  if (c === null) return { text: tx('changeNew'), short: '–' }
  if (Math.abs(c) < 0.005) return { text: tx('changeSame'), short: '±0 %' }
  const up = c > 0
  const value = percent(Math.abs(c), locale.value)
  return { text: tx(up ? 'changeUp' : 'changeDown', { value }), short: `${up ? '+' : '−'}${value}` }
}
const tiles = computed<Tile[]>(() => {
  const s = stats.value
  if (!s) return []
  const n = s.totals
  const p = s.previousTotals ?? undefined
  return [
    { key: 'visitors', label: tx('metric.visitors'), value: fmt(n.visitors), hint: tx('hint.visitors'), delta: delta(n.visitors, p?.visitors) },
    { key: 'visits', label: tx('metric.visits'), value: fmt(n.visits), delta: delta(n.visits, p?.visits) },
    { key: 'pageviews', label: tx('metric.pageviews'), value: fmt(n.pageviews), delta: delta(n.pageviews, p?.pageviews) },
    { key: 'viewsPerVisit', label: tx('metric.viewsPerVisit'), value: decimal(n.viewsPerVisit, locale.value), delta: delta(n.viewsPerVisit, p?.viewsPerVisit) },
    { key: 'bounceRate', label: tx('metric.bounceRate'), value: percent(n.bounceRate, locale.value), hint: tx('hint.bounceRate'), delta: delta(n.bounceRate, p?.bounceRate) },
    { key: 'avgEngaged', label: tx('metric.avgEngaged'), value: duration(n.avgEngagedMs), hint: tx('hint.avgEngaged'), delta: delta(n.avgEngagedMs, p?.avgEngagedMs) },
  ]
})

// ── the chart ──────────────────────────────────────────────────────────────────
const chart = computed(() => {
  const s = stats.value
  if (!s) return null
  const b = s.range.bucket
  const toPoints = (list: Stats['series']): ChartPoint[] => list.map((p) => ({ ...p, label: pointLabel(p.key, b) }))
  return { points: toPoints(s.series), previous: s.previousSeries ? toPoints(s.previousSeries) : null }
})
const chartLabels = computed(() => ({ visitors: tx('metric.visitors'), pageviews: tx('metric.pageviews'), previous: tx('chart.previous') }))
const people = (count: number) => tx('people', { count })

// ── the lists ──────────────────────────────────────────────────────────────────
function labelOf(dim: Dimension, value: string): { label: string; prefix?: string } {
  switch (dim) {
    case 'source': return { label: value === 'Direct' || value === 'Other' ? tx(`${detailed.value ? 'source' : 'friendlySource'}.${value}`) : value }
    case 'country': return { label: countryName(value, locale.value), prefix: flag(value) }
    case 'device': return { label: ['mobile', 'tablet', 'desktop'].includes(value) ? tx(`device.${value}`) : value }
    case 'locale':
    case 'language': return { label: languageName(value) || value }
    default: return { label: value }
  }
}
function itemsOf(dim: Dimension): BarItem[] {
  const list = stats.value?.lists?.[dim] ?? []
  return list.map((i) => {
    const page = dim === 'page' || dim === 'entry_page'
    const { label, prefix } = page && i.title ? { label: i.title, prefix: undefined } : labelOf(dim, i.value)
    return {
      key: i.value,
      label,
      prefix,
      sub: page && i.title ? i.value : undefined,
      value: i.visitors,
      detail: `${tx('metric.visitors')}: ${i.visitors} · ${tx('metric.visits')}: ${i.visits} · ${tx('metric.pageviews')}: ${i.pageviews}`,
      to: page && i.entity && i.id ? `/admin/${i.entity}/${i.id}` : undefined,
    }
  })
}
const filterValueLabel = (f: Filter) => {
  // An entry (from the editor's panel: "post:<id>") by its title, as the pages list knows it.
  if (f.dimension === 'entry') return stats.value?.lists?.page?.find((i) => i.entity && `${i.entity}:${i.id}` === f.value)?.title ?? f.value
  const s = stats.value?.lists?.[f.dimension]?.find((i) => i.value === f.value)
  return s?.title ?? labelOf(f.dimension, f.value).label
}

interface Card { id: string; tabs: { dim: Dimension; label: string }[] }
const cards = computed<Card[]>(() => [
  { id: 'pages', tabs: [{ dim: 'page', label: tx('list.pages') }, { dim: 'entry_page', label: tx('list.entryPages') }] },
  { id: 'sources', tabs: [{ dim: 'source', label: tx('list.sources') }, { dim: 'referrer', label: tx('list.referrers') }, { dim: 'utm_campaign', label: tx('list.campaigns') }, { dim: 'utm_source', label: tx('list.utmSources') }, { dim: 'utm_medium', label: tx('list.utmMediums') }] },
  { id: 'countries', tabs: [{ dim: 'country', label: tx('list.countries') }] },
  { id: 'devices', tabs: [{ dim: 'device', label: tx('list.devices') }, { dim: 'browser', label: tx('list.browsers') }, { dim: 'os', label: tx('list.systems') }] },
  { id: 'languages', tabs: [{ dim: 'locale', label: tx('list.locales') }, { dim: 'language', label: tx('list.languages') }] },
])
const tab = reactive<Record<string, Dimension>>({})
const tabOf = (c: Card) => tab[c.id] ?? c.tabs[0]!.dim

// The simple view's questions, each one list.
const questions = computed(() => [
  { id: 'pages', dim: 'page' as Dimension, title: tx('ask.pages'), icon: 'i-lucide-file-text', rows: 5 },
  { id: 'sources', dim: 'source' as Dimension, title: tx('ask.sources'), icon: 'i-lucide-search', rows: 5 },
  { id: 'devices', dim: 'device' as Dimension, title: tx('ask.devices'), icon: 'i-lucide-smartphone', rows: 3 },
  { id: 'countries', dim: 'country' as Dimension, title: tx('ask.countries'), icon: 'i-lucide-globe', rows: 5 },
])
const barProps = computed(() => ({
  locale: locale.value,
  empty: tx('list.empty'),
  filterLabel: (label: string) => tx('list.filterBy', { value: label }),
  openLabel: tx('list.openEntry'),
  moreLabel: (count: number) => tx('list.more', { count }),
  lessLabel: tx('list.less'),
}))

const empty = computed(() => !!stats.value && stats.value.totals.pageviews === 0 && !filters.value.length)
</script>

<template>
  <CmsPage :title="tx('title')" :description="tx('description')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: tx('title') }]">
    <template v-if="!noAccess" #meta>
      <div class="an-seg" role="group" :aria-label="tx('view.label')">
        <UButton size="sm" color="neutral" :variant="detailed ? 'ghost' : 'outline'" :aria-pressed="!detailed" :label="tx('view.simple')" class="an-seg__item" @click="setView('simple')" />
        <UButton size="sm" color="neutral" :variant="detailed ? 'outline' : 'ghost'" :aria-pressed="detailed" :label="tx('view.detailed')" class="an-seg__item" @click="setView('detailed')" />
      </div>
    </template>

    <CmsEmptyState v-if="noAccess" plain icon="i-lucide-lock" :title="tx('noAccess')" />
    <div v-else-if="error && !stats" class="py-10 text-center">
      <p class="text-sm text-muted">{{ tx('loadFailed') }}</p>
      <UButton class="mt-3" variant="outline" color="neutral" :label="tx('retry')" @click="refresh()" />
    </div>

    <div v-else class="space-y-6">
      <!-- the controls: one row above everything they scope -->
      <div v-if="detailed" class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <USelect
          :model-value="period" :items="periodItems" value-key="value" class="an-period" :aria-label="tx('period.label')"
          @update:model-value="(v: any) => setPeriod(v)"
        />
        <USwitch :model-value="compare" :label="tx('compare')" @update:model-value="(v: boolean) => setQuery({ compare: v ? undefined : '0' })" />
      </div>
      <div v-else class="an-chips-row">
        <UCarousel
          ref="chipsRow" v-slot="{ item }" :items="chips" drag-free align="start" contain-scroll="trimSnaps" class="min-w-0 flex-1"
          :ui="{ container: 'an-chips__container', item: 'an-chips__item' }" :aria-label="tx('period.label')"
        >
          <UButton
            size="sm" color="neutral" :variant="item === period ? 'solid' : 'outline'" :aria-pressed="item === period"
            :label="tx(`period.${item}`)" class="rounded-full" @click="setPeriod(item)"
          />
        </UCarousel>
        <UDropdownMenu :items="morePeriods" :content="{ align: 'end' }">
          <UButton size="sm" color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down" :label="tx('periodMore')" class="rounded-full shrink-0" />
        </UDropdownMenu>
      </div>
      <form v-if="period === 'custom'" class="flex flex-wrap items-center gap-2" @submit.prevent="applyCustom">
        <UInput v-model="customFrom" type="date" :max="stats?.today" :aria-label="tx('period.from')" class="an-date" />
        <span class="text-muted" aria-hidden="true">–</span>
        <UInput v-model="customTo" type="date" :max="stats?.today" :aria-label="tx('period.to')" class="an-date" />
        <UButton type="submit" variant="outline" color="neutral" :label="tx('period.apply')" />
      </form>

      <UAlert
        v-if="stats && !stats.collecting.on" color="neutral" variant="subtle" icon="i-lucide-circle-pause"
        :title="stats.collecting.server ? tx('off.settings') : tx('off.server')"
        :actions="stats.collecting.server && stats.collecting.canSwitch
          ? [{ label: tx('off.settingsLink'), to: '/admin/analytics_settings', color: 'neutral', variant: 'outline', trailingIcon: 'i-lucide-arrow-right' }]
          : undefined"
      />

      <!-- the filters: chips, each removable -->
      <div v-if="filters.length" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted">{{ tx('filters.label') }}</span>
        <UBadge v-for="f in filters" :key="f.dimension" color="neutral" variant="soft" size="lg" class="gap-1.5 pe-1">
          <span class="text-muted">{{ tx(`dimension.${f.dimension}`) }}:</span>
          <span class="max-w-60 truncate font-medium">{{ filterValueLabel(f) }}</span>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="tx('filters.remove', { name: filterValueLabel(f) })" @click="removeFilter(f.dimension)" />
        </UBadge>
        <UButton size="xs" variant="link" color="neutral" :label="tx('filters.clear')" @click="clearFilters" />
      </div>
      <p v-if="stats?.partial" class="flex items-start gap-2 text-sm text-muted">
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />{{ tx('filters.partial', { count: stats.keepRawDays }) }}
      </p>

      <div v-if="stats" class="space-y-6 transition-opacity" :class="pending ? 'opacity-60' : ''" :aria-busy="pending">
        <!-- ── SIMPLE ── -->
        <template v-if="!detailed">
          <!-- the story: one number, a few sentences, who is here now -->
          <section v-if="story" class="cms-moment an-story">
            <div class="min-w-0">
              <p class="cms-display an-story__number tabular-nums text-highlighted">{{ story.number }}</p>
              <p class="cms-display an-story__headline text-highlighted text-pretty">{{ story.headline }}</p>
              <p v-if="story.lines.length && !empty" class="cms-moment__muted an-story__lines text-pretty">{{ story.lines.join(' ') }}</p>
              <p v-if="liveText" class="an-live-pill text-sm text-highlighted" aria-live="polite" :title="tx('notYou')">
                <span class="an-live" :class="active ? '' : 'an-live--off'" aria-hidden="true" />{{ liveText }}
              </p>
            </div>
            <CmsAnimal v-if="animals" name="owl" class="an-story__animal h-20 w-auto" />
          </section>

          <CmsEmptyState v-if="empty" icon="i-lucide-chart-line" :title="tx('empty.title')" :description="tx('empty.text')" />

          <template v-else>
            <section class="cms-card p-4" :aria-label="tx(`chartSimple.${stats.range.bucket}`)">
              <h2 class="cms-label mb-2">{{ tx(`chartSimple.${stats.range.bucket}`) }}</h2>
              <AnalyticsLineChart v-if="chart" simple :people="people" :points="chart.points" :previous="chart.previous" :labels="chartLabels" :locale="locale" />
            </section>

            <dl class="an-plain">
              <div v-for="p in plain" :key="p.key" class="an-plain__item" :title="p.term">
                <dt class="sr-only">{{ p.term }}</dt>
                <dd class="cms-display text-lg text-highlighted">{{ p.value }}</dd>
                <dd class="text-sm text-muted">{{ p.label }}</dd>
                <dd v-if="p.change" class="cms-moment__muted text-xs">{{ p.change }}</dd>
              </div>
            </dl>

            <div class="an-lists">
              <section v-for="q in questions" :key="q.id" class="cms-card min-w-0 p-4" :aria-labelledby="`an-q-${q.id}`">
                <div class="cms-section__head an-q__head">
                  <span class="cms-section__tile" aria-hidden="true"><UIcon :name="q.icon" class="size-4" /></span>
                  <h2 :id="`an-q-${q.id}`" class="cms-section__title">{{ q.title }}</h2>
                </div>
                <!-- devices: one bar of shares, then the three with their share -->
                <template v-if="q.dim === 'device' && devices.length">
                  <div class="an-split" aria-hidden="true">
                    <span v-for="d in devices" :key="d.key" :style="{ flexGrow: d.share, background: d.tone }" />
                  </div>
                  <ul class="an-split__legend">
                    <li v-for="d in devices" :key="d.key">
                      <button type="button" class="an-split__row text-sm" :aria-label="tx('list.filterBy', { value: d.label })" @click="addFilter('device', d.key)">
                        <span class="flex items-center gap-2 text-highlighted"><span class="an-swatch" :style="{ background: d.tone }" aria-hidden="true" />{{ d.label }}</span>
                        <span class="tabular-nums text-highlighted">{{ percent(d.share, locale) }}</span>
                      </button>
                    </li>
                  </ul>
                </template>
                <AnalyticsBarList v-else v-bind="barProps" :items="itemsOf(q.dim)" :rows="q.rows" @select="(value: string) => addFilter(q.dim, value)" />
              </section>
            </div>

            <button type="button" class="an-more text-sm text-muted" @click="setView('detailed')">
              <span>{{ tx('moreDetails') }}</span>
              <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0" aria-hidden="true" />
            </button>
          </template>
        </template>

        <!-- ── DETAILED ── -->
        <template v-else>
          <dl class="an-tiles">
            <div v-for="tile in tiles" :key="tile.key" class="cms-card min-w-0 p-4">
              <dt class="flex items-center gap-1 text-xs font-medium text-muted">
                <span class="truncate">{{ tile.label }}</span>
                <UTooltip v-if="tile.hint" :text="tile.hint">
                  <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0 text-dimmed" :aria-label="tile.hint" />
                </UTooltip>
              </dt>
              <dd class="mt-1 text-2xl font-semibold text-highlighted whitespace-nowrap">{{ tile.value }}</dd>
              <!-- a change is a fact, not a verdict: no red or green for an ordinary week -->
              <dd v-if="tile.delta" class="mt-1 text-xs text-muted">
                <span class="truncate" :title="tile.delta.text" aria-hidden="true">{{ tile.delta.short }}</span><span class="sr-only">{{ tile.delta.text }}</span>
              </dd>
            </div>
            <div class="cms-card min-w-0 p-4 an-tile--live">
              <dt class="flex items-center gap-1 text-xs font-medium text-muted">
                <span class="an-live" aria-hidden="true" />
                <span class="truncate">{{ tx('metric.activeNow') }}</span>
                <UTooltip :text="tx('hint.activeNow')">
                  <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0 text-dimmed" :aria-label="tx('hint.activeNow')" />
                </UTooltip>
              </dt>
              <dd class="mt-1 text-2xl font-semibold text-highlighted" aria-live="polite">{{ active === null ? '–' : fmt(active) }}</dd>
              <dd class="mt-1 text-xs text-muted">{{ tx('notYou') }}</dd>
            </div>
          </dl>

          <CmsEmptyState v-if="empty" icon="i-lucide-chart-line" :title="tx('empty.title')" :description="tx('empty.text')" />

          <template v-else>
            <!-- visitors and pageviews over time -->
            <section class="cms-card p-4" :aria-label="tx('chart.title')">
              <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 class="cms-label">{{ tx('chart.title') }}</h2>
                <p class="text-xs text-muted">{{ stats.range.bucket === 'hour' ? tx('chart.hourly') : tx('chart.daily') }}</p>
              </div>
              <AnalyticsLineChart v-if="chart" :points="chart.points" :previous="chart.previous" :labels="chartLabels" :locale="locale" />
            </section>

            <!-- the lists -->
            <div class="an-lists">
              <section v-for="card in cards" :key="card.id" class="cms-card min-w-0 p-4" :class="card.id === 'pages' ? 'an-lists__wide' : ''">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 class="cms-label">{{ card.tabs.find((x) => x.dim === tabOf(card))?.label }}</h2>
                  <div v-if="card.tabs.length > 1" class="flex flex-wrap gap-1" role="group" :aria-label="card.tabs[0]!.label">
                    <UButton
                      v-for="x in card.tabs" :key="x.dim" size="xs" color="neutral" :variant="tabOf(card) === x.dim ? 'soft' : 'ghost'"
                      :aria-pressed="tabOf(card) === x.dim" :label="x.label" @click="tab[card.id] = x.dim"
                    />
                  </div>
                </div>
                <AnalyticsBarList
                  v-bind="barProps" paths :items="itemsOf(tabOf(card))" :rows="card.id === 'pages' ? 10 : 8"
                  @select="(value: string) => addFilter(tabOf(card), value)"
                />
              </section>
            </div>

            <!-- mode 'consent': among visitors who agreed to cookies, with their share of the visits -->
            <AnalyticsConsentReport v-if="stats.consent" :report="stats.consent" :keep-raw-days="stats.keepRawDays" />
          </template>
        </template>
      </div>

      <p class="flex items-start gap-2 text-xs text-muted">
        <UIcon name="i-lucide-shield-check" class="mt-0.5 size-4 shrink-0" />{{ tx(stats?.mode === 'consent' ? 'privacyConsent' : stats?.mode === 'strict' ? 'privacyStrict' : 'privacy') }}
      </p>
    </div>
  </CmsPage>
</template>

<style src="../app/analytics.css"></style>

<style scoped>
/* Layout the admin's own pages do not use, so it is written here (a site's Tailwind scans tinyzoo's app/ only). */
.an-period { width: 12rem; }
.an-date { width: 10rem; }

/* Simple | Detailed: two buttons in one pill. */
.an-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 9999px; background: var(--ui-bg-elevated); }
.an-seg :deep(.an-seg__item) { border-radius: 9999px; }
.an-seg :deep(.an-seg__item[aria-pressed='true']) { background: var(--cms-surface); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08); }

.an-chips-row { display: flex; align-items: center; gap: 0.5rem; }
/* A chip that runs past the edge fades out instead of being cut. */
.an-chips-row :deep(.an-chips__container) { padding-inline-end: 1.5rem; }
.an-chips-row > :first-child { mask-image: linear-gradient(to right, #000 calc(100% - 1.5rem), transparent); }

/* The story: the page's one cream moment. */
.an-story {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
  padding: 1.25rem;
}
.an-story__number { font-size: 2.75rem; line-height: 1; letter-spacing: -0.02em; font-weight: 800; }
.an-story__headline { margin-top: 0.5rem; font-size: 1.1875rem; line-height: 1.35; font-weight: 600; max-width: 32ch; }
.an-story__lines { margin-top: 0.375rem; font-size: 0.9375rem; max-width: 56ch; }
.an-story__animal { display: none; }
@media (min-width: 40rem) {
  .an-story { grid-template-columns: minmax(0, 1fr) auto; padding: 1.5rem; }
  .an-story__animal { display: block; }
}
.an-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.875rem;
  padding: 0.25rem 0.75rem 0.25rem 0.625rem;
  border-radius: 9999px;
  background: var(--cms-surface);
  border: 1px solid var(--cms-moment-line);
}

/* Three numbers in words. */
.an-plain { display: grid; gap: 0.75rem; grid-template-columns: minmax(0, 1fr); }
.an-plain__item { padding: 0.75rem 1rem; border-radius: calc(var(--ui-radius) * 1.5); background: var(--ui-bg-muted); min-width: 0; }
.an-plain__item dd { margin: 0; }
@media (min-width: 40rem) { .an-plain { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

.an-q__head { margin-bottom: 0.75rem; }

/* "What do they use?": one bar of shares, 2 px apart. */
.an-split { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; margin-bottom: 0.75rem; }
.an-split > span { display: block; min-width: 4px; }
.an-split__legend { display: flex; flex-direction: column; gap: 0.125rem; margin-inline: -0.5rem; }
.an-split__row { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.375rem 0.5rem; border-radius: var(--ui-radius); text-align: left; }
.an-split__row:hover { background: var(--ui-bg-muted); }
.an-swatch { width: 10px; height: 10px; border-radius: 3px; flex: none; }

.an-more {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--ui-border-accented);
  border-radius: calc(var(--ui-radius) * 1.5);
  text-align: left;
}
.an-more:hover { color: var(--ui-text-highlighted); background: var(--ui-bg-muted); }

/* Detailed. */
.an-tiles { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.an-tile--live { grid-column: span 2; }
.an-lists { display: grid; gap: 1rem; }
@media (min-width: 40rem) {
  .an-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .an-tile--live { grid-column: auto; }
}
@media (min-width: 64rem) {
  .an-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .an-lists { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .an-lists__wide { grid-column: span 2; }
}
/* "On the website now": a small dot that breathes, still for people who ask for less motion. */
.an-live {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: var(--ui-success);
  flex: none;
  animation: an-breathe 2.4s ease-in-out infinite;
}
.an-live--off { background: var(--ui-border-accented); animation: none; }
@keyframes an-breathe {
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .an-live { animation: none; }
}
</style>
