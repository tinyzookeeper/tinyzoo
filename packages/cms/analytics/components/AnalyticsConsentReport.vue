<script setup lang="ts">
// The Analytics page's section for `mode: 'consent'`: the reports among visitors who allowed
// statistics in the cookie banner. Its heading says what share of the visits they are, so
// nobody reads the sample as the total.
import { compactNumber, decimal, percent } from '../app/format'

interface ConsentReport {
  from: string | null
  to: string | null
  partial: boolean
  visits: number
  consentVisits: number
  share: number
  visitors: number
  newVisitors: number
  returningVisitors: number
  frequency: { key: '1' | '2' | '3-5' | '6+'; visitors: number }[]
  visitsPerVisitor: number
}

const props = defineProps<{ report: ConsentReport; keepRawDays: number }>()
const { t, locale } = useCmsI18n()
const tx = (key: string, params?: Record<string, unknown>) => t(`plugins.analytics.${key}`, params as any)
const uid = useId()

const fmt = (n: number) => compactNumber(n, locale.value)
const tiles = computed(() => {
  const r = props.report
  return [
    { key: 'visitors', label: tx('consent.visitors'), value: fmt(r.visitors), hint: tx('consent.visitorsHint') },
    { key: 'new', label: tx('consent.new'), value: fmt(r.newVisitors), hint: tx('consent.newHint') },
    { key: 'returning', label: tx('consent.returning'), value: fmt(r.returningVisitors), hint: tx('consent.returningHint', { count: props.keepRawDays }) },
    { key: 'perVisitor', label: tx('consent.perVisitor'), value: decimal(r.visitsPerVisitor, locale.value) },
  ]
})
const frequency = computed(() => {
  const max = Math.max(1, ...props.report.frequency.map((f) => f.visitors))
  return props.report.frequency.map((f) => ({
    ...f,
    label: f.key === '1' || f.key === '2' ? tx('consent.visitsCount', { count: Number(f.key) }) : tx('consent.visitsRange', { range: f.key.replace('-', '–') }),
    width: `${(f.visitors / max) * 100}%`,
    share: props.report.visitors ? percent(f.visitors / props.report.visitors, locale.value) : '–',
  }))
})
</script>

<template>
  <section class="cms-card p-4" :aria-labelledby="`${uid}-title`">
    <h2 :id="`${uid}-title`" class="cms-label">{{ tx('consent.title', { share: percent(report.share, locale) }) }}</h2>
    <p class="mt-1 text-sm text-muted">{{ tx('consent.about', { consentVisits: fmt(report.consentVisits), visits: fmt(report.visits) }) }}</p>

    <p v-if="!report.visitors" class="mt-4 text-sm text-muted">{{ tx('consent.none') }}</p>
    <template v-else>
      <dl class="an-c-tiles mt-4">
        <div v-for="tile in tiles" :key="tile.key" class="an-c-tile min-w-0">
          <dt class="flex items-center gap-1 text-xs font-medium text-muted">
            <span class="truncate">{{ tile.label }}</span>
            <UTooltip v-if="tile.hint" :text="tile.hint">
              <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0 text-dimmed" :aria-label="tile.hint" />
            </UTooltip>
          </dt>
          <dd class="mt-1 text-2xl font-semibold text-highlighted whitespace-nowrap">{{ tile.value }}</dd>
        </div>
      </dl>

      <h3 class="cms-label mt-5 mb-2">{{ tx('consent.frequency') }}</h3>
      <ul class="space-y-2">
        <li v-for="f in frequency" :key="f.key" class="an-c-row">
          <span class="an-c-bar" :style="{ width: f.width }" aria-hidden="true" />
          <span class="an-c-label text-sm">{{ f.label }}</span>
          <span class="an-c-value text-sm text-muted">{{ fmt(f.visitors) }} · {{ f.share }}</span>
        </li>
      </ul>
    </template>

    <div class="mt-4 space-y-1">
      <p v-if="report.partial" class="flex items-start gap-2 text-xs text-muted">
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />{{ tx('consent.partial', { count: keepRawDays }) }}
      </p>
      <p class="flex items-start gap-2 text-xs text-muted">
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />{{ tx('consent.forms') }}
      </p>
    </div>
  </section>
</template>

<style src="../app/analytics.css"></style>

<style scoped>
/* Layout of its own (a site's Tailwind scans tinyzoo's app/ only). */
.an-c-tiles { display: grid; gap: 1rem 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 64rem) { .an-c-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.an-c-tile { padding: 0.75rem; border-radius: var(--ui-radius); background: var(--ui-bg-muted); }
.an-c-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 2rem; padding: 0.25rem 0.5rem; }
.an-c-bar { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: calc(var(--ui-radius) * 0.75); background: var(--cms-an-bar); }
.an-c-label, .an-c-value { position: relative; }
.an-c-value { white-space: nowrap; }
</style>
