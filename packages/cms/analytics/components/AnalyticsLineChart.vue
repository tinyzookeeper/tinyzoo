<script setup lang="ts">
// The Analytics page's chart: visitors and pageviews over the period (one axis: both are
// counts), the period before as dashed lines. The friendly view (`simple`) draws visitors only:
// one warm line with a soft area, no axis numbers, the period before as one dashed grey line. A crosshair snaps to the nearest point and a
// tooltip lists every line there; the arrow keys do the same. A table carries every value for
// screen readers. Plain SVG, no chart library.
import { compactNumber, niceTicks } from '../app/format'
import type { ChartPoint } from '../app/types'

const props = defineProps<{
  points: ChartPoint[]
  previous?: ChartPoint[] | null
  /** Labels for the legend and tooltip. */
  labels: { visitors: string; pageviews: string; previous: string }
  locale: string
  /** Visitors only, said in words ("241 people"). */
  simple?: boolean
  /** "241 people", for the simple view's tooltip. */
  people?: (count: number) => string
}>()

const box = ref<HTMLElement | null>(null)
const width = ref(640)
let observer: ResizeObserver | null = null
onMounted(() => {
  if (!box.value) return
  width.value = box.value.clientWidth || 640
  observer = new ResizeObserver(([entry]) => { if (entry) width.value = Math.max(240, entry.contentRect.width) })
  observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const height = computed(() => (width.value < 480 ? 180 : 240))
const pad = computed(() => ({ top: 12, right: 12, bottom: 26, left: props.simple ? 12 : 40 }))
const inner = computed(() => ({ w: width.value - pad.value.left - pad.value.right, h: height.value - pad.value.top - pad.value.bottom }))

const max = computed(() => {
  const of = (p: ChartPoint) => (props.simple ? [p.visitors] : [p.visitors, p.pageviews])
  return Math.max(1, ...props.points.flatMap(of), ...(props.previous ?? []).flatMap(of))
})
const ticks = computed(() => niceTicks(max.value))
const top = computed(() => ticks.value[ticks.value.length - 1] || 1)

const x = (i: number) => {
  const n = props.points.length
  return pad.value.left + (n <= 1 ? inner.value.w / 2 : (i / (n - 1)) * inner.value.w)
}
const y = (v: number) => pad.value.top + inner.value.h - (v / top.value) * inner.value.h

const line = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
const area = (values: number[]) => values.length ? `${line(values)}L${x(values.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : ''

const series = computed(() => ({
  visitors: props.points.map((p) => p.visitors),
  pageviews: props.points.map((p) => p.pageviews),
  // The period before, point by point (as long as this one, or shorter).
  prevVisitors: (props.previous ?? []).slice(0, props.points.length).map((p) => p.visitors),
  prevPageviews: (props.previous ?? []).slice(0, props.points.length).map((p) => p.pageviews),
}))

// About six labels along the bottom, never crowded.
const xLabels = computed(() => {
  const n = props.points.length
  const room = Math.max(2, Math.floor(inner.value.w / 72))
  const step = Math.max(1, Math.ceil(n / room))
  return props.points.map((p, i) => ({ i, label: p.label })).filter(({ i }) => i % step === 0)
})

// ── the crosshair ──────────────────────────────────────────────────────────────
const active = ref<number | null>(null)
function pick(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const px = ((event.clientX - rect.left) / rect.width) * width.value
  const n = props.points.length
  if (!n) return
  const i = n <= 1 ? 0 : Math.round(((px - pad.value.left) / inner.value.w) * (n - 1))
  active.value = Math.max(0, Math.min(n - 1, i))
}
function key(event: KeyboardEvent) {
  const n = props.points.length
  if (!n) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    const d = event.key === 'ArrowRight' ? 1 : -1
    active.value = Math.max(0, Math.min(n - 1, (active.value ?? (d > 0 ? -1 : n)) + d))
  }
  else if (event.key === 'Home') active.value = 0
  else if (event.key === 'End') active.value = n - 1
  else if (event.key === 'Escape') active.value = null
}
const tip = computed(() => {
  if (active.value === null) return null
  const p = props.points[active.value]
  if (!p) return null
  const before = props.previous?.[active.value] ?? null
  const left = x(active.value)
  return { p, before, left, flip: left > width.value * 0.6 }
})
const fmt = (n: number) => compactNumber(n, props.locale)
// Two charts on one page (the page and a panel) must not share a gradient.
const fillId = `an-fill-${useId()}`
</script>

<template>
  <div class="an-chart">
    <!-- legend: a line key per series, text in the text colours (one series needs none: the title names it) -->
    <ul v-if="!simple || previous?.length" class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <li v-if="!simple" class="flex items-center gap-1.5"><span class="an-key" style="background: var(--cms-an-visitors)" />{{ labels.visitors }}</li>
      <li v-if="!simple" class="flex items-center gap-1.5"><span class="an-key" style="background: var(--cms-an-pageviews)" />{{ labels.pageviews }}</li>
      <li v-if="previous?.length" class="flex items-center gap-1.5"><span class="an-key an-key--dashed" />{{ labels.previous }}</li>
    </ul>
    <div ref="box" class="relative">
      <svg
        :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" class="block w-full select-none an-svg"
        role="img" tabindex="0" :aria-label="simple ? labels.visitors : `${labels.visitors}, ${labels.pageviews}`"
        @pointermove="pick" @pointerdown="pick" @pointerleave="active = null" @keydown="key" @blur="active = null"
      >
        <defs>
          <linearGradient :id="fillId" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--cms-an-visitors)" :stop-opacity="simple ? 0.2 : 0.1" />
            <stop offset="100%" stop-color="var(--cms-an-visitors)" :stop-opacity="simple ? 0 : 0.1" />
          </linearGradient>
        </defs>
        <!-- grid and ticks: hairlines, recessive (the friendly view keeps the lines, not the numbers) -->
        <g>
          <template v-for="v in ticks" :key="v">
            <line :x1="pad.left" :x2="width - pad.right" :y1="y(v)" :y2="y(v)" stroke="var(--cms-an-grid)" stroke-width="1" shape-rendering="crispEdges" />
            <text v-if="!simple" :x="pad.left - 8" :y="y(v)" dy="0.32em" text-anchor="end" class="an-tick">{{ fmt(v) }}</text>
          </template>
          <!-- the simple view has no left margin, so its first and last labels hang inward -->
          <text
            v-for="l in xLabels" :key="l.i" :x="x(l.i)" :y="height - 6" class="an-tick"
            :text-anchor="simple && l.i === 0 ? 'start' : simple && l.i === points.length - 1 ? 'end' : 'middle'"
          >{{ l.label }}</text>
        </g>
        <!-- the period before: dashed, behind -->
        <g v-if="series.prevVisitors.length" fill="none" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" :opacity="simple ? 1 : 0.5">
          <path v-if="!simple" :d="line(series.prevPageviews)" stroke="var(--cms-an-pageviews)" />
          <path :d="line(series.prevVisitors)" :stroke="simple ? 'var(--ui-border-accented)' : 'var(--cms-an-visitors)'" :stroke-width="simple ? 1.5 : 2" />
        </g>
        <!-- this period -->
        <path :d="area(series.visitors)" :fill="`url(#${fillId})`" />
        <path v-if="!simple" :d="line(series.pageviews)" fill="none" stroke="var(--cms-an-pageviews)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <path :d="line(series.visitors)" fill="none" stroke="var(--cms-an-visitors)" :stroke-width="simple ? 2.5 : 2" stroke-linejoin="round" stroke-linecap="round" />
        <template v-if="points.length === 1">
          <circle v-if="!simple" :cx="x(0)" :cy="y(series.pageviews[0] ?? 0)" r="4" fill="var(--cms-an-pageviews)" />
          <circle :cx="x(0)" :cy="y(series.visitors[0] ?? 0)" r="4" fill="var(--cms-an-visitors)" />
        </template>
        <!-- crosshair -->
        <g v-if="tip">
          <line :x1="tip.left" :x2="tip.left" :y1="pad.top" :y2="pad.top + inner.h" stroke="var(--ui-border-accented)" stroke-width="1" />
          <circle v-if="!simple" :cx="tip.left" :cy="y(tip.p.pageviews)" r="4" fill="var(--cms-an-pageviews)" stroke="var(--cms-surface)" stroke-width="2" />
          <circle :cx="tip.left" :cy="y(tip.p.visitors)" :r="simple ? 5 : 4" fill="var(--cms-an-visitors)" stroke="var(--cms-surface)" stroke-width="2" />
        </g>
      </svg>
      <div
        v-if="tip" class="an-tip pointer-events-none absolute top-1 z-10 rounded-md border border-default bg-default px-3 py-2 text-xs shadow-sm"
        :style="tip.flip ? { right: `${width - tip.left + 12}px` } : { left: `${tip.left + 12}px` }" aria-live="polite"
      >
        <p class="mb-1 font-medium text-highlighted whitespace-nowrap">{{ tip.p.label }}</p>
        <template v-if="simple">
          <p class="whitespace-nowrap"><strong class="tabular-nums text-highlighted">{{ people ? people(tip.p.visitors) : fmt(tip.p.visitors) }}</strong></p>
          <p v-if="tip.before" class="mt-1 whitespace-nowrap text-muted">{{ tip.before.label }}: <span class="tabular-nums">{{ fmt(tip.before.visitors) }}</span></p>
        </template>
        <template v-else>
          <p class="flex items-center gap-2 whitespace-nowrap"><span class="an-key" style="background: var(--cms-an-visitors)" /><strong class="tabular-nums text-highlighted">{{ fmt(tip.p.visitors) }}</strong><span class="text-muted">{{ labels.visitors }}</span></p>
          <p class="flex items-center gap-2 whitespace-nowrap"><span class="an-key" style="background: var(--cms-an-pageviews)" /><strong class="tabular-nums text-highlighted">{{ fmt(tip.p.pageviews) }}</strong><span class="text-muted">{{ labels.pageviews }}</span></p>
          <p v-if="tip.before" class="mt-1 flex items-center gap-2 whitespace-nowrap text-muted">
            <span class="an-key an-key--dashed" />{{ tip.before.label }}: <span class="tabular-nums">{{ fmt(tip.before.visitors) }} · {{ fmt(tip.before.pageviews) }}</span>
          </p>
        </template>
      </div>
    </div>
    <!-- every value, for screen readers -->
    <table class="sr-only">
      <thead><tr><th scope="col" /><th scope="col">{{ labels.visitors }}</th><th v-if="!simple" scope="col">{{ labels.pageviews }}</th></tr></thead>
      <tbody>
        <tr v-for="p in points" :key="p.key"><th scope="row">{{ p.label }}</th><td>{{ p.visitors }}</td><td v-if="!simple">{{ p.pageviews }}</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style src="../app/analytics.css"></style>

<style scoped>
.an-key {
  display: inline-block;
  width: 12px;
  height: 2px;
  border-radius: 1px;
  flex: none;
}
.an-key--dashed {
  background: repeating-linear-gradient(90deg, var(--ui-text-muted) 0 4px, transparent 4px 7px);
}
.an-tick {
  font-size: 11px;
  fill: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
}
.an-svg {
  height: auto;
  outline: none;
  touch-action: pan-y;
}
.an-svg:focus-visible {
  outline: 2px solid var(--cms-accent-ring, var(--ui-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
