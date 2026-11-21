<script setup lang="ts">
import type { CheckPoint } from '#keeper/types/keeper'

// The last 24 hours of checks, calm: the typical (median) answer time per 15 minutes as one line,
// a faint band from the fastest to the slowest answer of each 15 minutes, a faint grid, and the
// failed checks as small red marks along the bottom. Pointing at it shows a crosshair with the
// time and the typical answer then. Plain SVG, scaled to its box.
const props = defineProps<{ checks: CheckPoint[] }>()
const now = useNow()

const W = 600
const H = 132
const TOP = 6
const BASE = 112 // the zero line; the failed checks sit under it
const SLOT = 15 * 60 * 1000
const SLOTS = 96

// Whole quarter hours (07:30, 07:45), the last one the quarter we are in.
const start = computed(() => Math.floor(now.value / SLOT) * SLOT - (SLOTS - 1) * SLOT)
const x = (t: number) => ((t - start.value) / (SLOTS * SLOT)) * W

interface Bucket { t: number; median: number; min: number; max: number }
/** One point per 15 minutes with answers: its middle, the median, the fastest and slowest. */
const buckets = computed<(Bucket | null)[]>(() => {
  const slots: number[][] = Array.from({ length: SLOTS }, () => [])
  for (const c of props.checks) {
    if (!c.ok || c.ms == null) continue
    const i = Math.floor((Date.parse(c.at) - start.value) / SLOT)
    if (i >= 0 && i < SLOTS) slots[i]!.push(c.ms)
  }
  return slots.map((ms, i) => {
    if (!ms.length) return null
    ms.sort((a, b) => a - b)
    return { t: start.value + (i + 0.5) * SLOT, median: ms[Math.floor(ms.length / 2)]!, min: ms[0]!, max: ms.at(-1)! }
  })
})

const STEPS = [100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 5000, 10_000, 20_000, 30_000]
/** The top of the scale: a round number a little above the highest typical time. */
const top = computed(() => {
  const highest = Math.max(0, ...buckets.value.map((b) => b?.median ?? 0))
  return STEPS.find((s) => s >= highest * 1.15) ?? STEPS.at(-1)!
})
const y = (ms: number) => TOP + (1 - Math.min(ms, top.value) / top.value) * (BASE - TOP)
const grid = computed(() => [0.25, 0.5, 0.75, 1].map((f) => y(top.value * f)))

/** Runs of neighbouring 15 minutes with answers: a gap (no answers) breaks the line and the band. */
const runs = computed(() => {
  const out: Bucket[][] = []
  let run: Bucket[] = []
  for (const b of buckets.value) {
    if (b) run.push(b)
    else if (run.length) { out.push(run); run = [] }
  }
  if (run.length) out.push(run)
  return out
})
const f = (n: number) => n.toFixed(1)
const line = computed(() => runs.value.map((r) => r.map((b, i) => `${i ? 'L' : 'M'}${f(x(b.t))},${f(y(b.median))}`).join('') + (r.length === 1 ? `h0.01` : '')).join(''))
const band = computed(() => runs.value.map((r) => {
  const pad = r.length === 1 ? 2 : 0
  const upper = r.map((b, i) => `${i ? 'L' : 'M'}${f(x(b.t) - (i === 0 ? pad : 0))},${f(y(b.max))}`).join('')
  const lower = [...r].reverse().map((b, i) => `L${f(x(b.t) + (i === 0 ? pad : 0))},${f(y(b.min))}`).join('')
  return `${upper}${lower}Z`
}).join(''))
const failed = computed(() => props.checks.filter((c) => !c.ok).map((c) => x(Date.parse(c.at))).filter((v) => v >= 0 && v <= W))

const typical = computed(() => typicalMs(props.checks))
const label = computed(() => `Typical answer time over the last 24 hours${typical.value != null ? `: ${typical.value} ms` : ''}${failed.value.length ? `, ${failed.value.length === 1 ? '1 failed check' : `${failed.value.length} failed checks`}` : ''}.`)

// The crosshair: the 15 minutes nearest the pointer that have answers.
const box = ref<HTMLElement | null>(null)
const hover = ref<Bucket | null>(null)
function point(e: PointerEvent) {
  const r = box.value?.getBoundingClientRect()
  if (!r?.width) return
  const i = Math.max(0, Math.min(SLOTS - 1, Math.floor(((e.clientX - r.left) / r.width) * SLOTS)))
  let best: Bucket | null = null
  for (let d = 0; d < SLOTS && !best; d++) best = buckets.value[i - d] ?? buckets.value[i + d] ?? null
  hover.value = best
}
const hoverAt = computed(() => (hover.value ? (x(hover.value.t) / W) * 100 : 0))
const hoverText = computed(() => {
  if (!hover.value) return ''
  const time = new Date(hover.value.t - SLOT / 2).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${time} · typically ${hover.value.median} ms`
})
</script>

<template>
  <figure>
    <div ref="box" class="relative touch-pan-y" @pointermove="point" @pointerdown="point" @pointerleave="hover = null">
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="block h-32 w-full" role="img" :aria-label="label">
        <title>{{ label }}</title>
        <line v-for="(gy, i) in grid" :key="i" x1="0" :x2="W" :y1="gy" :y2="gy" stroke="var(--ui-border-muted)" stroke-width="1" vector-effect="non-scaling-stroke" />
        <line x1="0" :x2="W" :y1="BASE" :y2="BASE" stroke="var(--ui-border)" stroke-width="1" vector-effect="non-scaling-stroke" />
        <path v-if="band" :d="band" fill="var(--ui-text-highlighted)" opacity="0.07" />
        <path v-if="line" :d="line" fill="none" stroke="var(--ui-text)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        <line
          v-for="(fx, i) in failed" :key="`f${i}`"
          :x1="fx" :x2="fx" :y1="BASE + 7" :y2="BASE + 16"
          stroke="var(--k-down-long)" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"
        />
        <line v-if="hover" :x1="x(hover.t)" :x2="x(hover.t)" :y1="TOP" :y2="BASE" stroke="var(--k-moment-line)" stroke-width="1" vector-effect="non-scaling-stroke" />
      </svg>
      <template v-if="hover">
        <span
          class="pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--k-surface) bg-(--ui-text)"
          :style="{ left: `${hoverAt}%`, top: `${(y(hover.median) / H) * 100}%` }"
          aria-hidden="true"
        />
        <span
          class="pointer-events-none absolute top-0 z-10 rounded-md bg-(--k-tip) px-2 py-1 text-[0.71875rem] font-medium whitespace-nowrap text-(--k-tip-text) tabular shadow-sm"
          :style="{ left: `${hoverAt}%`, transform: `translateX(${hoverAt > 60 ? 'calc(-100% - 8px)' : '8px'})` }"
          aria-hidden="true"
        >{{ hoverText }}</span>
      </template>
    </div>
    <figcaption class="mt-1 flex justify-between gap-2 text-xs text-muted tabular">
      <span>24 h ago</span>
      <span class="text-center">Typical answer time, up to {{ top.toLocaleString('en-GB') }} ms</span>
      <span>now</span>
    </figcaption>
    <p v-if="!checks.length" class="mt-2 text-sm text-muted">No checks in the last 24 hours yet.</p>
  </figure>
</template>
