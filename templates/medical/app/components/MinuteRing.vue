<script setup lang="ts">
// Ciferník's minute ring: a circle with the number of minutes it takes to walk somewhere; a full
// circle is ten minutes.
const props = defineProps<{ minutes: number; label: string }>()
const r = 40
const len = 2 * Math.PI * r
const dash = computed(() => `${(len * Math.min(props.minutes, 10) / 10).toFixed(1)} ${len.toFixed(1)}`)
const words = useSiteWords()
</script>

<template>
  <svg viewBox="0 0 100 100" class="block size-[5.6rem]" role="img" :aria-label="label">
    <circle cx="50" cy="50" :r="r" fill="var(--card)" stroke="var(--track)" stroke-width="9" />
    <circle cx="50" cy="50" :r="r" fill="none" stroke="var(--brand)" stroke-width="9" stroke-linecap="round" :stroke-dasharray="dash" transform="rotate(-90 50 50)" />
    <text x="50" y="47" text-anchor="middle" dominant-baseline="central" class="font-display" font-weight="500" font-size="30" fill="var(--ink)">{{ minutes }}</text>
    <text x="50" y="68" text-anchor="middle" font-weight="700" font-size="10.5" fill="var(--quiet)">{{ words.minutesShort }}</text>
  </svg>
</template>
