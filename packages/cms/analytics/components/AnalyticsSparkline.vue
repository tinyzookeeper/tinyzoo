<script setup lang="ts">
// A small line of one series (a point per day) for the home card and the editor's panel: the
// shape of the period, no axes. The last point carries a dot. Its name says what it shows.
const props = withDefaults(defineProps<{ values: number[]; label: string; width?: number; height?: number }>(), { width: 160, height: 36 })

const path = computed(() => {
  const n = props.values.length
  const max = Math.max(1, ...props.values)
  const pad = 4
  const w = props.width - pad * 2
  const h = props.height - pad * 2
  const pts = props.values.map((v, i) => [pad + (n <= 1 ? w / 2 : (i / (n - 1)) * w), pad + h - (v / max) * h] as const)
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')
  const last = pts[pts.length - 1]
  const area = pts.length ? `${d}L${pts[pts.length - 1]![0].toFixed(1)},${pad + h}L${pts[0]![0].toFixed(1)},${pad + h}Z` : ''
  return { d, area, last }
})
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" role="img" :aria-label="label" class="block max-w-full" style="overflow: visible">
    <path :d="path.area" fill="var(--cms-an-visitors)" opacity="0.1" />
    <path :d="path.d" fill="none" stroke="var(--cms-an-visitors)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    <circle v-if="path.last" :cx="path.last[0]" :cy="path.last[1]" r="3.5" fill="var(--cms-an-visitors)" stroke="var(--cms-surface)" stroke-width="2" />
  </svg>
</template>

<style src="../app/analytics.css"></style>
