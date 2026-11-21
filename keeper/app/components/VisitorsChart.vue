<script setup lang="ts">
// Visitors a day (or an hour, `hourly`) for the Simple view: one warm 2.5 px line with a soft
// fill under it, the period before as a quiet dashed grey line when there is one (`before`, lined
// up point by point), a faint grid without numbers, and a crosshair with the day in words on
// hover or touch. A last point marked `partial` (today so far) is joined by a dashed line.
// The numbers themselves are in the Detailed view's table.
const props = defineProps<{
  series: { day: string; visitors: number; partial?: boolean }[]
  before?: number[]
  hourly?: boolean
  /** What the dashed line is, for the legend and the tooltip ("last week"). */
  beforeLabel?: string
}>()

const uid = useId()
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

const H = 170
const PAD = { top: 12, right: 8, bottom: 22, left: 8 }
const plotW = computed(() => Math.max(1, width.value - PAD.left - PAD.right))
const plotH = H - PAD.top - PAD.bottom

const prev = computed(() => (props.before && props.before.length ? props.before.slice(-props.series.filter((p) => !p.partial).length) : null))
const top = computed(() => Math.max(4, ...props.series.map((p) => p.visitors), ...(prev.value ?? [])) * 1.1)
const n = computed(() => props.series.length)
const x = (i: number) => PAD.left + (n.value > 1 ? (i / (n.value - 1)) * plotW.value : plotW.value / 2)
const y = (v: number) => PAD.top + (1 - v / top.value) * plotH
const grid = computed(() => [0, 0.5, 1].map((f) => PAD.top + f * plotH))

const partial = computed(() => !!props.series.at(-1)?.partial)
const pt = (i: number) => `${x(i).toFixed(1)},${y(props.series[i]!.visitors).toFixed(1)}`
const solidTo = computed(() => (partial.value ? n.value - 2 : n.value - 1))
const line = computed(() => props.series.slice(0, solidTo.value + 1).map((_, i) => `${i ? 'L' : 'M'}${pt(i)}`).join(''))
const area = computed(() => (solidTo.value >= 1 ? `${line.value}L${x(solidTo.value).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : ''))
const dashed = computed(() => (partial.value && n.value > 1 ? `M${pt(n.value - 2)}L${pt(n.value - 1)}` : ''))
const beforeLine = computed(() => (prev.value ? prev.value.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') : ''))

const hourOf = (day: string) => Number(day.slice(11, 13)) || 0
function dayLabel(day: string, long = false, isPartial = false): string {
  if (props.hourly) {
    const h = hourOf(day)
    return long ? `${h}:00 to ${h + 1}:00` : `${h}:00`
  }
  if (isPartial) return long ? 'Today so far' : 'Today'
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const xLabels = computed(() => {
  if (!n.value) return []
  const idx = n.value < 3 ? [0, n.value - 1] : [0, Math.floor((n.value - 1) / 2), n.value - 1]
  return [...new Set(idx)].map((i) => ({ x: x(i), text: dayLabel(props.series[i]!.day, false, !!props.series[i]!.partial), anchor: i === 0 ? 'start' : i === n.value - 1 ? 'end' : 'middle' }))
})
const fmt = (v: number) => v.toLocaleString('en-GB')
const beforeName = computed(() => (props.beforeLabel ? `${props.beforeLabel.charAt(0).toUpperCase()}${props.beforeLabel.slice(1)}` : 'The period before'))
const people = (v: number) => `${fmt(v)} ${peopleWord(v)}`

// ── hover ──
const active = ref<number | null>(null)
function pick(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  if (!n.value) return
  const i = n.value > 1 ? Math.round(((e.clientX - rect.left - PAD.left) / plotW.value) * (n.value - 1)) : 0
  active.value = Math.min(n.value - 1, Math.max(0, i))
}
const tip = computed(() => {
  if (active.value == null) return null
  const p = props.series[active.value]
  if (!p) return null
  const left = x(active.value)
  return { p, left, before: prev.value?.[active.value], flip: left > width.value * 0.6 }
})

const total = computed(() => props.series.reduce((a, p) => a + p.visitors, 0))
const label = computed(() => {
  const s = props.series
  if (!s.length) return props.hourly ? 'No hours to show yet.' : 'No days to show yet.'
  const span = `${dayLabel(s[0]!.day)} to ${dayLabel(s.at(-1)!.day, false, !!s.at(-1)!.partial)}`
  return props.hourly
    ? `Visitors each hour today, ${span}: ${people(total.value)} so far.`
    : `Visitors each day, ${span}: ${people(total.value)} in all${prev.value ? `, with ${props.beforeLabel ?? 'the period before'} as a dashed line` : ''}.`
})
</script>

<template>
  <figure>
    <div ref="box" class="relative">
      <svg
        :width="width" :height="H" :viewBox="`0 0 ${width} ${H}`" class="block w-full touch-pan-y select-none overflow-visible"
        role="img" :aria-label="label"
        @pointermove="pick" @pointerdown="pick" @pointerleave="active = null"
      >
        <title>{{ label }}</title>
        <defs>
          <linearGradient :id="`${uid}-fill`" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--k-visitors)" stop-opacity="0.18" />
            <stop offset="100%" stop-color="var(--k-visitors)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line v-for="g in grid" :key="g" :x1="PAD.left" :x2="PAD.left + plotW" :y1="g" :y2="g" stroke="var(--k-grid-soft)" stroke-width="1" />
        <g class="fill-(--ui-text-muted) text-[11px]">
          <text v-for="l in xLabels" :key="l.text" :x="l.x" :y="H - 4" :text-anchor="l.anchor">{{ l.text }}</text>
        </g>
        <path v-if="beforeLine" :d="beforeLine" fill="none" stroke="var(--k-visitors-before)" stroke-width="1.5" stroke-dasharray="4 5" stroke-linecap="round" stroke-linejoin="round" />
        <path v-if="area" :d="area" :fill="`url(#${uid}-fill)`" />
        <path :d="line" fill="none" stroke="var(--k-visitors)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        <path v-if="dashed" :d="dashed" fill="none" stroke="var(--k-visitors)" stroke-width="2.5" stroke-dasharray="3 4" stroke-linecap="round" />
        <circle v-if="partial" :cx="x(n - 1)" :cy="y(series.at(-1)!.visitors)" r="3" fill="var(--k-visitors)" />
        <g v-if="tip">
          <line :x1="tip.left" :x2="tip.left" :y1="PAD.top" :y2="PAD.top + plotH" stroke="var(--k-moment-line)" stroke-width="1" />
          <circle :cx="tip.left" :cy="y(tip.p.visitors)" r="5" fill="var(--k-visitors)" stroke="var(--k-surface)" stroke-width="2" />
        </g>
      </svg>
      <div
        v-if="tip"
        class="pointer-events-none absolute top-1 z-10 rounded-lg border border-(--k-moment-line) bg-(--k-surface) px-2.5 py-1.5 text-xs shadow-sm"
        :style="tip.flip ? { right: `${width - tip.left + 10}px` } : { left: `${tip.left + 10}px` }"
      >
        <p class="whitespace-nowrap text-(--k-moment-text)">{{ dayLabel(tip.p.day, true, !!tip.p.partial) }}</p>
        <p class="font-display text-sm font-bold whitespace-nowrap text-highlighted tabular">{{ people(tip.p.visitors) }}</p>
        <p v-if="tip.before != null" class="whitespace-nowrap text-muted tabular">{{ beforeName }}: {{ fmt(tip.before) }}</p>
      </div>
    </div>
    <figcaption v-if="beforeLine" class="mt-1 flex items-center gap-1.5 text-xs text-muted">
      <svg width="16" height="4" aria-hidden="true"><line x1="1" x2="15" y1="2" y2="2" stroke="var(--k-visitors-before)" stroke-width="1.5" stroke-dasharray="4 3" stroke-linecap="round" /></svg>
      {{ beforeName }}
    </figcaption>
  </figure>
</template>
