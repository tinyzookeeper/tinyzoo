<script setup lang="ts">
// Who is there right now: visitors in the last 5 minutes, with a soft pulse while anyone is,
// and today's visitors so far when the page shows days.
const props = withDefaults(defineProps<{ active: number; today?: number | null; where?: string }>(), { today: null, where: 'on the site' })
const fmt = (n: number) => n.toLocaleString('en-GB')
const people = computed(() => (props.active === 1 ? '1 person' : `${fmt(props.active)} people`))
</script>

<template>
  <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-live="polite">
    <span class="relative inline-flex size-2.5 shrink-0">
      <span v-if="active" class="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
      <span class="relative inline-flex size-2.5 rounded-full" :class="active ? 'bg-success' : 'bg-(--ui-border-accented)'" />
    </span>
    <span class="text-highlighted"><strong class="font-semibold tabular">{{ active ? people : 'Nobody' }}</strong> {{ where }} right now</span>
    <span v-if="today != null" class="text-muted tabular">· {{ fmt(today) }} {{ today === 1 ? 'visitor' : 'visitors' }} today so far</span>
  </p>
</template>
