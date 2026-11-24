<script setup lang="ts">
// A symbol of the dashboard: a warning light of a group of the price list, or the frost warning of a
// seasonal offer. The paths are Material Design Icons (Lucide has no dashboard symbols), drawn
// in the colour of the text and 1em large.
defineProps<{ path: string }>()
</script>

<template>
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path :d="path" /></svg>
</template>
