<script setup lang="ts">
// Visitors a day as a small line (the site list): one series, no axis, the last day marked.
// The number beside it carries the value; the line only shows the shape.
const props = withDefaults(defineProps<{ values: number[]; label: string; width?: number; height?: number }>(), { width: 96, height: 28 })

const PAD = 3
const points = computed(() => {
  const v = props.values
  const max = Math.max(1, ...v)
  const step = v.length > 1 ? (props.width - PAD * 2) / (v.length - 1) : 0
  return v.map((n, i) => ({ x: PAD + i * step, y: PAD + (1 - n / max) * (props.height - PAD * 2) }))
})
const d = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''))
const last = computed(() => points.value.at(-1))
</script>

<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="label" class="block shrink-0 overflow-visible">
    <title>{{ label }}</title>
    <path :d="d" fill="none" stroke="currentColor" class="text-(--ui-text-dimmed)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    <circle v-if="last" :cx="last.x" :cy="last.y" r="2.5" fill="var(--k-series-1)" stroke="var(--k-surface)" stroke-width="1.5" />
  </svg>
</template>
