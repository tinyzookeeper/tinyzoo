<script setup lang="ts">
import type { CheckPoint } from '#shared/types/keeper'

// The last 24 hours of checks: response time as a line, failed checks as red ticks
// along the bottom. Plain SVG, scaled to its box.
const props = defineProps<{ checks: CheckPoint[] }>()
const now = useNow()

const W = 600
const H = 120
const PAD_TOP = 8
const PAD_BOTTOM = 14

const span = computed(() => {
  const end = now.value
  return { start: end - 24 * 60 * 60 * 1000, end }
})
const x = (iso: string) => ((Date.parse(iso) - span.value.start) / (span.value.end - span.value.start)) * W

const maxMs = computed(() => {
  const ms = props.checks.filter((c) => c.ok && c.ms != null).map((c) => c.ms!)
  if (!ms.length) return 1000
  // The 98th percentile, so one slow check does not flatten the rest.
  const sorted = [...ms].sort((a, b) => a - b)
  return Math.max(200, sorted[Math.floor(sorted.length * 0.98)] ?? sorted.at(-1)!)
})
const y = (ms: number) => PAD_TOP + (1 - Math.min(ms, maxMs.value) / maxMs.value) * (H - PAD_TOP - PAD_BOTTOM)

/** One path; a failed check breaks the line. */
const path = computed(() => {
  let d = ''
  let pen = false
  for (const c of props.checks) {
    if (!c.ok || c.ms == null) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${x(c.at).toFixed(1)},${y(c.ms).toFixed(1)}`
    pen = true
  }
  return d
})
const failed = computed(() => props.checks.filter((c) => !c.ok).map((c) => x(c.at)))
const median = computed(() => {
  const ms = props.checks.filter((c) => c.ok && c.ms != null).map((c) => c.ms!).sort((a, b) => a - b)
  return ms.length ? ms[Math.floor(ms.length / 2)]! : null
})
const label = computed(() => `Response time over the last 24 hours${median.value != null ? `, typically ${median.value} ms` : ''}${failed.value.length ? `, ${failed.value.length} failed checks` : ''}.`)
</script>

<template>
  <figure>
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="h-28 w-full" role="img" :aria-label="label">
      <title>{{ label }}</title>
      <line :x1="0" :x2="W" :y1="H - PAD_BOTTOM" :y2="H - PAD_BOTTOM" stroke="currentColor" class="text-(--ui-border)" stroke-width="1" vector-effect="non-scaling-stroke" />
      <line :x1="0" :x2="W" :y1="PAD_TOP" :y2="PAD_TOP" stroke="currentColor" class="text-(--ui-border-muted)" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke" />
      <path v-if="path" :d="path" fill="none" stroke="currentColor" class="text-highlighted" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      <line
        v-for="(fx, i) in failed"
        :key="i"
        :x1="fx" :x2="fx" :y1="H - PAD_BOTTOM + 2" :y2="H"
        stroke="currentColor" class="text-error" stroke-width="2" vector-effect="non-scaling-stroke"
      />
    </svg>
    <figcaption class="mt-1 flex justify-between text-xs text-muted tabular">
      <span>24 h ago</span>
      <span>{{ maxMs }} ms at the top</span>
      <span>now</span>
    </figcaption>
    <p v-if="!checks.length" class="mt-2 text-sm text-muted">No checks in the last 24 hours yet.</p>
  </figure>
</template>
