<script setup lang="ts">
// The Analytics page (/admin/p/analytics): a period and its comparison, the headline numbers,
// visitors and pageviews over time, and lists of pages, sources, countries, devices and
// languages. A click on any row filters the whole page by it; the period, the comparison and
// the filters live in the address, so a view can be shared and comes back on reload.
import { compactNumber, countryName, decimal, duration, flag, percent } from '../app/format'
import { type Dimension, type Filter, filtersQuery, parseFilters } from '../core/dimensions'
import { PERIODS, type Period, isPeriod } from '../core/range'
import { change } from '../core/rollup'
import type { BarItem, ChartPoint } from '../app/types'

definePageMeta({ layout: 'admin' })
const { t, locale, formatDateWith, languageName } = useCmsI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const tx = (key: string, params?: Record<string, unknown>) => t(`plugins.analytics.${key}`, params as any)
useHead({ title: () => tx('title') })

// ── the state in the address ─────────────────────────────────────────────────────
const period = computed<Period>(() => (isPeriod(route.query.period) ? route.query.period : '7d'))
const compare = computed(() => route.query.compare !== '0')
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

// ── switching collecting off and on (administrators) ────────────────────────────
const switching = ref(false)
async function setCollecting(on: boolean) {
  switching.value = true
  try {
    await $fetch('/api/cms/_singleton/analytics_settings', { method: 'PUT', body: { collect: on } })
    await refresh()
  }
  catch (err: any) {
    toast.add({ color: 'error', title: err?.data?.statusMessage ?? err?.statusMessage ?? String(err) })
  }
  finally {
    switching.value = false
  }
}

// ── the headline numbers ────────────────────────────────────────────────────────
const fmt = (n: number) => compactNumber(n, locale.value)
type Tile = { key: string; label: string; value: string; hint?: string; delta?: { text: string; short: string; good: boolean | null; up: boolean | null } | null }
function delta(now: number, before: number | undefined, upIsGood = true): Tile['delta'] {
  if (before === undefined) return null
  const c = change(now, before)
  if (c === null) return { text: tx('changeNew'), short: '–', good: null, up: null }
  if (Math.abs(c) < 0.005) return { text: tx('changeSame'), short: '±0 %', good: null, up: null }
  const up = c > 0
  const value = percent(Math.abs(c), locale.value)
  return { text: tx(up ? 'changeUp' : 'changeDown', { value }), short: `${up ? '+' : '−'}${value}`, good: up === upIsGood, up }
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
    { key: 'bounceRate', label: tx('metric.bounceRate'), value: percent(n.bounceRate, locale.value), hint: tx('hint.bounceRate'), delta: delta(n.bounceRate, p?.bounceRate, false) },
    { key: 'avgEngaged', label: tx('metric.avgEngaged'), value: duration(n.avgEngagedMs), hint: tx('hint.avgEngaged'), delta: delta(n.avgEngagedMs, p?.avgEngagedMs) },
  ]
})

// ── the chart ──────────────────────────────────────────────────────────────────
const pointLabel = (key: string, bucket: 'hour' | 'day') => (bucket === 'hour'
  ? `${key.padStart(2, '0')}:00`
  : formatDateWith(`${key}T12:00:00`, { day: 'numeric', month: 'short' }))
const chart = computed(() => {
  const s = stats.value
  if (!s) return null
  const b = s.range.bucket
  const toPoints = (list: Stats['series']): ChartPoint[] => list.map((p) => ({ ...p, label: pointLabel(p.key, b) }))
  return { points: toPoints(s.series), previous: s.previousSeries ? toPoints(s.previousSeries) : null }
})
const chartLabels = computed(() => ({ visitors: tx('metric.visitors'), pageviews: tx('metric.pageviews'), previous: tx('chart.previous') }))

// ── the lists ──────────────────────────────────────────────────────────────────
function labelOf(dim: Dimension, value: string): { label: string; prefix?: string } {
  switch (dim) {
    case 'source': return { label: value === 'Direct' || value === 'Other' ? tx(`source.${value}`) : value }
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

const empty = computed(() => !!stats.value && stats.value.totals.pageviews === 0 && !filters.value.length)
</script>

<template>
  <CmsPage :title="tx('title')" :description="tx('description')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: tx('title') }]">
    <CmsEmptyState v-if="noAccess" plain icon="i-lucide-lock" :title="tx('noAccess')" />
    <div v-else-if="error && !stats" class="py-10 text-center">
      <p class="text-sm text-muted">{{ tx('loadFailed') }}</p>
      <UButton class="mt-3" variant="outline" color="neutral" :label="tx('retry')" @click="refresh()" />
    </div>

    <div v-else class="space-y-6">
      <!-- the controls: one row above everything they scope -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <USelect
          :model-value="period" :items="periodItems" value-key="value" class="an-period" :aria-label="tx('period.label')"
          @update:model-value="(v: any) => setPeriod(v)"
        />
        <form v-if="period === 'custom'" class="flex flex-wrap items-center gap-2" @submit.prevent="applyCustom">
          <UInput v-model="customFrom" type="date" :max="stats?.today" :aria-label="tx('period.from')" class="an-date" />
          <span class="text-muted" aria-hidden="true">–</span>
          <UInput v-model="customTo" type="date" :max="stats?.today" :aria-label="tx('period.to')" class="an-date" />
          <UButton type="submit" variant="outline" color="neutral" :label="tx('period.apply')" />
        </form>
        <USwitch :model-value="compare" :label="tx('compare')" @update:model-value="(v: boolean) => setQuery({ compare: v ? undefined : '0' })" />
        <div class="an-push flex items-center gap-2 text-sm">
          <USwitch
            v-if="stats?.collecting.canSwitch && stats.collecting.server" :model-value="stats.collecting.settings" :loading="switching"
            :label="tx('collecting')" @update:model-value="(v: boolean) => setCollecting(v)"
          />
        </div>
      </div>

      <UAlert
        v-if="stats && !stats.collecting.on" color="neutral" variant="subtle" icon="i-lucide-circle-pause"
        :title="stats.collecting.server ? tx('off.settings') : tx('off.server')"
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
        <!-- the headline numbers -->
        <dl class="an-tiles">
          <div v-for="tile in tiles" :key="tile.key" class="cms-card min-w-0 p-4">
            <dt class="flex items-center gap-1 text-xs font-medium text-muted">
              <span class="truncate">{{ tile.label }}</span>
              <UTooltip v-if="tile.hint" :text="tile.hint">
                <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0 text-dimmed" :aria-label="tile.hint" />
              </UTooltip>
            </dt>
            <dd class="mt-1 text-2xl font-semibold text-highlighted whitespace-nowrap">{{ tile.value }}</dd>
            <dd v-if="tile.delta" class="mt-1 flex items-center gap-1 text-xs" :class="tile.delta.good === null ? 'text-muted' : tile.delta.good ? 'text-success' : 'text-error'">
              <UIcon v-if="tile.delta.up !== null" :name="tile.delta.up ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'" class="size-3.5 shrink-0" aria-hidden="true" />
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
                :items="itemsOf(tabOf(card))" :locale="locale" :empty="tx('list.empty')"
                :filter-label="(label: string) => tx('list.filterBy', { value: label })" :open-label="tx('list.openEntry')"
                :more-label="(count: number) => tx('list.more', { count })" :less-label="tx('list.less')"
                :rows="card.id === 'pages' ? 10 : 8"
                @select="(value: string) => addFilter(tabOf(card), value)"
              />
            </section>
          </div>
        </template>
      </div>

      <p class="flex items-start gap-2 text-xs text-muted">
        <UIcon name="i-lucide-shield-check" class="mt-0.5 size-4 shrink-0" />{{ tx('privacy') }}
      </p>
    </div>
  </CmsPage>
</template>

<style scoped>
/* Layout the admin's own pages do not use, so it is written here (a site's Tailwind scans tinyzoo's app/ only). */
.an-period { width: 12rem; }
.an-date { width: 10rem; }
.an-push { margin-inline-start: auto; }
.an-tiles { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.an-tile--live { grid-column: span 2; }
.an-lists { display: grid; gap: 1rem; }
@media (min-width: 40rem) {
  .an-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .an-tile--live { grid-column: auto; }
}
@media (min-width: 64rem) {
  .an-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (min-width: 64rem) {
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
@keyframes an-breathe {
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .an-live { animation: none; }
}
</style>
