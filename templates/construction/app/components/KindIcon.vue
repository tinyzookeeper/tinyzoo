<script setup lang="ts">
// The pictogram of a kind of job in Výkres: what exists is drawn in black, what is new in the
// colour of the site (as on a renovation drawing).
defineProps<{ kind: 'new' | 'renovation' | 'extension' | 'roof' }>()
</script>

<template>
  <svg viewBox="0 0 40 28" aria-hidden="true">
    <path d="M1 27h38" stroke="currentColor" stroke-width="1" />
    <template v-if="kind === 'new'"><path d="M8 27V13l12-9 12 9v14" fill="none" stroke="var(--brand)" stroke-width="2" /></template>
    <template v-else-if="kind === 'renovation'"><path d="M8 27V13l12-9 12 9v14" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M8 19h24M20 19v8" fill="none" stroke="var(--brand)" stroke-width="2" /></template>
    <template v-else-if="kind === 'extension'"><path d="M4 27V13l10-8 10 8v14" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M24 17h13v10" fill="none" stroke="var(--brand)" stroke-width="2" /></template>
    <template v-else><path d="M8 27V14M32 27V14" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M4 16 20 4l16 12" fill="none" stroke="var(--brand)" stroke-width="2" /></template>
  </svg>
</template>
