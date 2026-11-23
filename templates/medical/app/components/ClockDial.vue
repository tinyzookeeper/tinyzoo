<script setup lang="ts">
// Ciferník's dial: a twelve-hour clock face whose arcs are the parts of one day the practice is
// open, coloured by whom the part is for. With the hands of the moment given (today's dial).
// Without `segs` it is only the face: what the server draws, before the browser knows the day.
// A day that is open longer than twelve hours would need a second ring.
import type { Seg } from '~/utils/site'

const props = withDefaults(defineProps<{ segs?: Seg[]; big?: boolean; minutes?: number | null; label?: string }>(), { segs: () => [], big: false, minutes: null, label: '' })

const C = 100
const R = computed(() => (props.big ? 84 : 80))
const W = computed(() => (props.big ? 13 : 17))
// (rounded: the last digits of a sine are not the same in the server's JavaScript and the browser's)
const round = (n: number) => Math.round(n * 100) / 100
const point = (angle: number, r: number): [number, number] => [round(C + r * Math.sin(angle * Math.PI / 180)), round(C - r * Math.cos(angle * Math.PI / 180))]
const fmt = (p: [number, number]) => p.join(' ')
// 12 hours round the face, 30° an hour
const angleOf = (m: number) => (m / 60 % 12) * 30

const arcs = computed(() => props.segs.map((s) => {
  // a little gap at each end keeps neighbouring arcs apart
  const gap = 1.1
  const sweep = (s.toM - s.fromM) / 2 - 2 * gap
  const start = angleOf(s.fromM) + gap
  return { id: s.id, color: KIND_COLOR[s.kind] ?? KIND_COLOR.booked, d: `M${fmt(point(start, R.value))}A${R.value} ${R.value} 0 ${sweep > 180 ? 1 : 0} 1 ${fmt(point(start + sweep, R.value))}` }
}))

const marks = computed(() => Array.from({ length: 12 }, (_, i) => {
  const h = i + 1
  const main = h % 3 === 0
  const [x, y] = point(h * 30, props.big ? 61 : main ? 54 : 56)
  return { h, main, x, y, numeral: props.big || main, size: props.big ? (main ? 15 : 11.5) : 15 }
}))

const hands = computed(() => {
  if (props.minutes == null) return null
  const hour = point((props.minutes / 60 % 12) * 30, props.big ? 36 : 30)
  const minute = point((props.minutes % 60) * 6, props.big ? 50 : 42)
  return { hour: `M${C} ${C}L${fmt(hour)}`, minute: `M${C} ${C}L${fmt(minute)}` }
})
</script>

<template>
  <svg viewBox="0 0 200 200" role="img" :aria-label="label || undefined" class="block w-full h-auto">
    <circle :cx="C" :cy="C" r="98" fill="var(--card)" />
    <circle :cx="C" :cy="C" :r="R" fill="none" stroke="var(--track)" :stroke-width="W" />
    <path v-for="a in arcs" :key="a.id" :d="a.d" fill="none" :stroke="a.color" :stroke-width="W" />
    <template v-for="m in marks" :key="m.h">
      <text v-if="m.numeral" :x="m.x" :y="m.y" text-anchor="middle" dominant-baseline="central" class="font-display" font-weight="500" :font-size="m.size" fill="var(--ink)" :opacity="m.main ? 1 : 0.7">{{ m.h }}</text>
      <circle v-else :cx="m.x" :cy="m.y" r="1.7" fill="var(--ink)" opacity=".4" />
    </template>
    <template v-if="hands">
      <path :d="hands.hour" stroke="var(--ink)" :stroke-width="big ? 5.5 : 6.5" stroke-linecap="round" />
      <path :d="hands.minute" stroke="var(--ink)" :stroke-width="big ? 3.6 : 4.4" stroke-linecap="round" />
      <circle :cx="C" :cy="C" :r="big ? 4.6 : 5.4" fill="var(--brand)" stroke="var(--card)" stroke-width="1.6" />
    </template>
  </svg>
</template>
