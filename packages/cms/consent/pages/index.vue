<script setup lang="ts">
// The Cookie consent page (/admin/p/consent): how visitors answer the banner, in counts only
// (accepted all, rejected all, chose some, per week or month), how often each category is
// allowed, and the version of the banner's texts with "Ask everyone again". Never a single
// record of the log.
import { percent } from '../../analytics/app/format'

definePageMeta({ layout: 'admin' })
const { t, locale, formatDateWith } = useCmsI18n()
const toast = useToast()
const confirm = useCmsConfirm()
const route = useRoute()
const router = useRouter()
const tx = (key: string, params?: Record<string, unknown>) => t(`plugins.consent.${key}`, params as any)
useHead({ title: () => tx('title') })

type Period = '12w' | '12m'
const period = computed<Period>(() => (route.query.period === '12m' ? '12m' : '12w'))
const periodItems = computed(() => (['12w', '12m'] as const).map((p) => ({ label: tx(`period.${p}`), value: p })))
const setPeriod = (p: Period) => router.replace({ query: { ...route.query, period: p === '12w' ? undefined : p } })

interface Point { key: string; all: number; none: number; custom: number; total: number; withdrawn: number }
interface Stats {
  period: Period
  unit: 'week' | 'month'
  version: number
  keepLogDays: number
  totals: Omit<Point, 'key'>
  series: Point[]
  categories: { key: string; label: string | Record<string, string> | null; granted: number }[]
}
const { data, error, pending, refresh } = await useFetch<Stats>('/api/cms/_p/consent/stats', { query: computed(() => ({ period: period.value })) })
const stats = ref<Stats | null>(data.value ?? null)
watch(data, (d) => { if (d) stats.value = d })
const noAccess = computed(() => error.value?.statusCode === 403)

const share = (n: number, total: number) => (total ? percent(n / total, locale.value) : '–')
const tiles = computed(() => {
  const s = stats.value
  if (!s) return []
  const n = s.totals
  return [
    { key: 'total', label: tx('metric.total'), value: String(n.total), sub: '', hint: tx('hint.total') },
    { key: 'all', label: tx('metric.all'), value: share(n.all, n.total), sub: String(n.all) },
    { key: 'none', label: tx('metric.none'), value: share(n.none, n.total), sub: String(n.none) },
    { key: 'custom', label: tx('metric.custom'), value: share(n.custom, n.total), sub: String(n.custom) },
    { key: 'withdrawn', label: tx('metric.withdrawn'), value: String(n.withdrawn), sub: '', hint: tx('hint.withdrawn') },
  ]
})

const bucketLabel = (key: string, unit: 'week' | 'month') => formatDateWith(`${key}T12:00:00`, unit === 'month' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
const bars = computed(() => {
  const s = stats.value
  if (!s) return []
  const max = Math.max(1, ...s.series.map((p) => p.total))
  return s.series.map((p) => ({
    ...p,
    label: bucketLabel(p.key, s.unit),
    height: `${Math.round((p.total / max) * 100)}%`,
    parts: (['all', 'custom', 'none'] as const).map((k) => ({ key: k, size: p.total ? `${(p[k] / p.total) * 100}%` : '0%' })),
    aria: tx('chart.label', { all: p.all, none: p.none, custom: p.custom }),
  }))
})

const categoryLabel = (c: Stats['categories'][number]) => {
  if (c.key === 'analytics' || c.key === 'marketing') return tx(`category.${c.key}`)
  if (typeof c.label === 'string') return c.label
  return c.label?.[locale.value] ?? c.label?.en ?? Object.values(c.label ?? {})[0] ?? c.key
}

const asking = ref(false)
async function askAgain() {
  const ok = await confirm({ title: tx('version.confirmTitle'), description: tx('version.confirmText'), confirmLabel: tx('version.confirm'), cancelLabel: tx('version.cancel'), color: 'warning', icon: 'i-lucide-rotate-ccw' })
  if (!ok) return
  asking.value = true
  try {
    const res = await $fetch<{ version: number }>('/api/cms/_p/consent/ask-again', { method: 'POST', body: {} })
    toast.add({ color: 'success', title: tx('version.done', { version: res.version }) })
    await refresh()
  }
  catch (err: any) {
    toast.add({ color: 'error', title: err?.data?.statusMessage ?? err?.statusMessage ?? String(err) })
  }
  finally {
    asking.value = false
  }
}

const empty = computed(() => !!stats.value && stats.value.totals.total === 0)
</script>

<template>
  <CmsPage :title="tx('title')" :description="tx('description')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: tx('title') }]">
    <CmsEmptyState v-if="noAccess" plain icon="i-lucide-lock" :title="tx('noAccess')" />
    <div v-else-if="error && !stats" class="py-10 text-center">
      <p class="text-sm text-muted">{{ tx('loadFailed') }}</p>
      <UButton class="mt-3" variant="outline" color="neutral" :label="tx('retry')" @click="refresh()" />
    </div>

    <div v-else class="space-y-6">
      <!-- the banner's texts and their version -->
      <section class="cms-card p-4" :aria-label="tx('version.title')">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="cms-label">{{ tx('version.title') }}</h2>
            <p class="mt-1 text-sm font-medium text-highlighted">{{ stats ? tx('version.current', { version: stats.version }) : '–' }}</p>
            <p class="mt-1 text-sm text-muted">{{ tx('version.text') }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton variant="outline" color="neutral" icon="i-lucide-pencil" :label="tx('version.edit')" to="/admin/consent_settings" />
            <UButton color="neutral" variant="soft" icon="i-lucide-rotate-ccw" :loading="asking" :label="tx('version.askAgain')" @click="askAgain" />
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <USelect :model-value="period" :items="periodItems" value-key="value" class="cs-period" :aria-label="tx('period.label')" @update:model-value="(v: any) => setPeriod(v)" />
      </div>

      <div v-if="stats" class="space-y-6 transition-opacity" :class="pending ? 'opacity-60' : ''" :aria-busy="pending">
        <dl class="cs-tiles">
          <div v-for="tile in tiles" :key="tile.key" class="cms-card min-w-0 p-4">
            <dt class="flex items-center gap-1 text-xs font-medium text-muted">
              <span v-if="tile.key === 'all' || tile.key === 'none' || tile.key === 'custom'" class="cs-swatch" :class="`cs-swatch--${tile.key}`" aria-hidden="true" />
              <span class="truncate">{{ tile.label }}</span>
              <UTooltip v-if="tile.hint" :text="tile.hint">
                <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0 text-dimmed" :aria-label="tile.hint" />
              </UTooltip>
            </dt>
            <dd class="mt-1 text-2xl font-semibold text-highlighted whitespace-nowrap">{{ tile.value }}</dd>
            <dd v-if="tile.sub" class="mt-1 text-xs text-muted">{{ tile.sub }}</dd>
          </div>
        </dl>

        <CmsEmptyState v-if="empty" icon="i-lucide-cookie" :title="tx('empty.title')" :description="tx('empty.text')" />

        <template v-else>
          <section class="cms-card p-4" :aria-label="tx('chart.title')">
            <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="cms-label">{{ tx('chart.title') }}</h2>
              <p class="text-xs text-muted">{{ stats.unit === 'month' ? tx('chart.month') : tx('chart.week') }}</p>
            </div>
            <ol class="cs-bars">
              <li v-for="b in bars" :key="b.key" class="cs-bar" :title="`${b.label}: ${b.aria}`">
                <span class="cs-bar__col">
                  <span class="cs-bar__stack" :style="{ height: b.height }">
                    <span v-for="part in b.parts" :key="part.key" class="cs-bar__part" :class="`cs-swatch--${part.key}`" :style="{ height: part.size }" />
                  </span>
                </span>
                <span class="cs-bar__label">{{ b.label }}</span>
                <span class="sr-only">{{ b.aria }}</span>
              </li>
            </ol>
            <ul class="cs-legend" aria-hidden="true">
              <li v-for="k in (['all', 'custom', 'none'] as const)" :key="k"><span class="cs-swatch" :class="`cs-swatch--${k}`" />{{ tx(`metric.${k}`) }}</li>
            </ul>
          </section>

          <section class="cms-card p-4" :aria-label="tx('categories.title')">
            <h2 class="cms-label mb-3">{{ tx('categories.title') }}</h2>
            <ul class="space-y-3">
              <li v-for="c in stats.categories" :key="c.key" class="min-w-0">
                <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span class="font-medium text-highlighted">{{ categoryLabel(c) }}</span>
                  <span class="text-muted">{{ share(c.granted, stats.totals.total) }} · {{ tx('categories.of', { count: c.granted, total: stats.totals.total }) }}</span>
                </div>
                <span class="cs-meter" aria-hidden="true"><span class="cs-meter__fill" :style="{ width: stats.totals.total ? `${(c.granted / stats.totals.total) * 100}%` : '0%' }" /></span>
              </li>
            </ul>
          </section>
        </template>

        <p class="flex items-start gap-2 text-xs text-muted">
          <UIcon name="i-lucide-shield-check" class="mt-0.5 size-4 shrink-0" />{{ tx('keep', { count: stats.keepLogDays }) }}
        </p>
      </div>
    </div>
  </CmsPage>
</template>

<style scoped>
/* Layout the admin's own pages do not use, so it is written here (a site's Tailwind scans tinyzoo's app/ only). */
.cs-period { width: 12rem; }
.cs-tiles { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 40rem) { .cs-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 64rem) { .cs-tiles { grid-template-columns: repeat(5, minmax(0, 1fr)); } }

/* Three answers, two hues checked for colour-blind readers and a neutral: accepted all blue,
   rejected all orange, some grey. Text never takes them. */
.cs-swatch--all { background: #2a78d6; }
.cs-swatch--none { background: #eb6834; }
.cs-swatch--custom { background: #8a9099; }
:global(html.dark) .cs-swatch--all { background: #3987e5; }
:global(html.dark) .cs-swatch--none { background: #d95926; }
:global(html.dark) .cs-swatch--custom { background: #7d838c; }
.cs-swatch { display: inline-block; width: 0.625rem; height: 0.625rem; border-radius: 2px; flex: none; }

.cs-bars { list-style: none; margin: 0; padding: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0.375rem; height: 12rem; }
.cs-bar { display: flex; flex-direction: column; min-width: 0; gap: 0.375rem; }
.cs-bar__col { flex: 1; display: flex; align-items: flex-end; border-bottom: 1px solid var(--ui-border); }
.cs-bar__stack { width: 100%; display: flex; flex-direction: column-reverse; border-radius: 3px 3px 0 0; overflow: hidden; min-height: 0; }
.cs-bar__part { display: block; width: 100%; }
.cs-bar__label { font-size: 0.6875rem; color: var(--ui-text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: clip; }
@media (max-width: 40rem) {
  /* Every other label on a phone, so they do not run into each other. */
  .cs-bar:nth-child(even) .cs-bar__label { visibility: hidden; }
}
.cs-legend { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; font-size: 0.75rem; color: var(--ui-text-muted); }
.cs-legend li { display: inline-flex; align-items: center; gap: 0.375rem; }

.cs-meter { display: block; height: 0.5rem; margin-top: 0.375rem; border-radius: 999px; background: var(--ui-bg-elevated); overflow: hidden; }
.cs-meter__fill { display: block; height: 100%; border-radius: 999px; background: #2a78d6; }
:global(html.dark) .cs-meter__fill { background: #3987e5; }
</style>
