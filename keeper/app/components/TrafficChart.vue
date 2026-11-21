<script setup lang="ts">
// Visitors and pageviews a day: two 2 px lines on one axis (both are counts), hairline
// grid, a legend with line keys, the last value labelled at each line's end, and a
// crosshair with the day's numbers on hover or touch. Drawn in pixels of its own width,
// so text and dots keep their size on a phone. A last point marked `partial` (today so far)
// is joined by a dashed line; `hourly` points are the hours of one day (day "YYYY-MM-DDTHH").
const props = defineProps<{ series: { day: string; visitors: number; pageviews: number; partial?: boolean }[]; hourly?: boolean }>()

const box = ref<HTMLElement | null>(null)
const width = ref(640)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!box.value) return
  width.value = box.value.clientWidth || width.value
  observer = new ResizeObserver(([entry]) => { if (entry) width.value = Math.max(240, Math.round(entry.contentRect.width)) })
  observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const H = 180
const PAD = { top: 10, right: 44, bottom: 22, left: 36 }
const plotW = computed(() => Math.max(1, width.value - PAD.left - PAD.right))
const plotH = H - PAD.top - PAD.bottom

/** A round top for the axis: 1, 2 or 5 times a power of ten, at least the largest value. */
function niceMax(v: number): number {
  if (v <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}
const top = computed(() => niceMax(Math.max(0, ...props.series.map((p) => Math.max(p.visitors, p.pageviews)))))
const ticks = computed(() => [0, top.value / 2, top.value])

const x = (i: number) => PAD.left + (props.series.length > 1 ? (i / (props.series.length - 1)) * plotW.value : plotW.value / 2)
const y = (v: number) => PAD.top + (1 - v / top.value) * plotH

const SERIES = [
  { key: 'visitors', label: 'Visitors', color: 'var(--k-series-1)' },
  { key: 'pageviews', label: 'Pageviews', color: 'var(--k-series-2)' },
] as const

const partial = computed(() => !!props.series.at(-1)?.partial)
const pt = (i: number, key: 'visitors' | 'pageviews') => `${x(i).toFixed(1)},${y(props.series[i]![key]).toFixed(1)}`
const paths = computed(() => SERIES.map((s) => {
  const n = props.series.length
  const solidTo = partial.value ? n - 2 : n - 1
  return {
    ...s,
    d: props.series.slice(0, solidTo + 1).map((_, i) => `${i ? 'L' : 'M'}${pt(i, s.key)}`).join(''),
    // Today so far: from the last complete day, dashed.
    dashed: partial.value && n > 1 ? `M${pt(n - 2, s.key)}L${pt(n - 1, s.key)}` : '',
    last: props.series.at(-1)?.[s.key] ?? 0,
  }
}))

/** End labels, pushed apart when the two lines end close together. */
const endLabels = computed(() => {
  const ys = paths.value.map((p) => y(p.last))
  if (Math.abs(ys[0]! - ys[1]!) < 12) {
    const mid = (ys[0]! + ys[1]!) / 2
    const up = ys[0]! <= ys[1]! ? 0 : 1
    ys[up] = mid - 6
    ys[1 - up] = mid + 6
  }
  return paths.value.map((p, i) => ({ ...p, y: ys[i]! }))
})

const hourOf = (day: string) => Number(day.slice(11, 13)) || 0
function dayLabel(day: string, long = false, isPartial = false): string {
  if (props.hourly) {
    const h = hourOf(day)
    return long ? `${h}:00–${h + 1}:00` : `${h}:00`
  }
  if (isPartial) return long ? 'Today so far' : 'Today'
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const xLabels = computed(() => {
  const n = props.series.length
  if (!n) return []
  const idx = n < 3 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1]
  return [...new Set(idx)].map((i) => ({ x: x(i), text: dayLabel(props.series[i]!.day, false, !!props.series[i]!.partial), anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }))
})
const fmt = (n: number) => n.toLocaleString('en-GB')
const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n))

// ── hover ──
const active = ref<number | null>(null)
function pick(e: PointerEvent) {
  const svg = e.currentTarget as SVGElement
  const rect = svg.getBoundingClientRect()
  const px = e.clientX - rect.left
  const n = props.series.length
  if (!n) return
  const i = n > 1 ? Math.round(((px - PAD.left) / plotW.value) * (n - 1)) : 0
  active.value = Math.min(n - 1, Math.max(0, i))
}
const tip = computed(() => {
  if (active.value == null) return null
  const p = props.series[active.value]
  if (!p) return null
  const left = x(active.value)
  return { p, left, flip: left > width.value * 0.6 }
})

const total = computed(() => props.series.reduce((a, p) => a + p.visitors, 0))
const label = computed(() => {
  const s = props.series
  if (!s.length) return props.hourly ? 'No hours to show yet.' : 'No days to show yet.'
  if (props.hourly) return `Visitors and pageviews an hour today, ${dayLabel(s[0]!.day)} to ${dayLabel(s.at(-1)!.day)}: ${fmt(s.at(-1)!.visitors)} visitors in the last hour.`
  return `Visitors and pageviews a day, ${dayLabel(s[0]!.day)} to ${dayLabel(s.at(-1)!.day, false, !!s.at(-1)!.partial)}: ${fmt(total.value)} visitors in all, ${fmt(s.at(-1)!.visitors)} on the last day${partial.value ? ' so far' : ''}.`
})
</script>

<template>
  <figure>
    <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span v-for="s in SERIES" :key="s.key" class="inline-flex items-center gap-1.5">
        <svg width="14" height="4" aria-hidden="true"><line x1="1" x2="13" y1="2" y2="2" :stroke="s.color" stroke-width="2" stroke-linecap="round" /></svg>
        {{ s.label }}
      </span>
    </div>
    <div ref="box" class="relative">
      <svg
        :width="width" :height="H" :viewBox="`0 0 ${width} ${H}`" class="block w-full touch-pan-y select-none overflow-visible"
        role="img" :aria-label="label"
        @pointermove="pick" @pointerdown="pick" @pointerleave="active = null"
      >
        <title>{{ label }}</title>
        <g class="text-(--ui-border)">
          <line v-for="t in ticks" :key="t" :x1="PAD.left" :x2="PAD.left + plotW" :y1="y(t)" :y2="y(t)" stroke="currentColor" stroke-width="1" />
        </g>
        <g class="fill-(--ui-text-muted) text-[11px] tabular">
          <text v-for="t in ticks" :key="t" :x="PAD.left - 6" :y="y(t) + 4" text-anchor="end">{{ compact(t) }}</text>
          <text v-for="l in xLabels" :key="l.text" :x="l.x" :y="H - 4" :text-anchor="l.anchor">{{ l.text }}</text>
        </g>
        <path v-for="p in paths" :key="p.key" :d="p.d" fill="none" :stroke="p.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <path v-for="p in paths.filter((q) => q.dashed)" :key="`${p.key}-today`" :d="p.dashed" fill="none" :stroke="p.color" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" />
        <circle v-for="p in partial ? paths : []" :key="`${p.key}-dot`" :cx="x(series.length - 1)" :cy="y(p.last)" r="3" :fill="p.color" />
        <g class="fill-(--ui-text-toned) text-[11px] font-medium tabular">
          <text v-for="l in endLabels" :key="l.key" :x="PAD.left + plotW + 6" :y="l.y + 4">{{ compact(l.last) }}</text>
        </g>
        <g v-if="tip">
          <line :x1="tip.left" :x2="tip.left" :y1="PAD.top" :y2="PAD.top + plotH" stroke="currentColor" class="text-(--ui-border-accented)" stroke-width="1" />
          <circle v-for="p in paths" :key="p.key" :cx="tip.left" :cy="y(tip.p[p.key])" r="4" :fill="p.color" stroke="var(--k-surface)" stroke-width="2" />
        </g>
      </svg>
      <div
        v-if="tip"
        class="pointer-events-none absolute top-1 z-10 rounded-md border border-default bg-(--k-surface) px-2.5 py-1.5 text-xs shadow-sm"
        :style="tip.flip ? { right: `${width - tip.left + 10}px` } : { left: `${tip.left + 10}px` }"
      >
        <p class="mb-0.5 font-medium text-highlighted">{{ dayLabel(tip.p.day, true, !!tip.p.partial) }}</p>
        <p v-for="s in SERIES" :key="s.key" class="flex items-center gap-1.5 text-toned tabular">
          <svg width="10" height="4" aria-hidden="true"><line x1="1" x2="9" y1="2" y2="2" :stroke="s.color" stroke-width="2" stroke-linecap="round" /></svg>
          {{ s.label }} <span class="ml-auto pl-3 text-highlighted">{{ fmt(tip.p[s.key]) }}</span>
        </p>
      </div>
    </div>
  </figure>
</template>
