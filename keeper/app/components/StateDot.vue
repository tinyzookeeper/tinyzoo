<script setup lang="ts">
import type { SiteState } from '#keeper/types/keeper'

const props = withDefaults(defineProps<{ state: SiteState; size?: 'sm' | 'md' }>(), { size: 'md' })
const label = computed(() => ({ up: 'Up', down: 'Down', unknown: 'Not checked yet' })[props.state])
</script>

<template>
  <span class="relative inline-flex shrink-0" :class="size === 'sm' ? 'size-2' : 'size-2.5'" role="img" :aria-label="label" :title="label">
    <span v-if="state === 'down'" class="absolute inset-0 rounded-full bg-error opacity-60 animate-ping" />
    <span
      class="relative inline-flex rounded-full size-full"
      :class="{ 'bg-success': state === 'up', 'bg-error': state === 'down', 'bg-(--ui-text-dimmed)': state === 'unknown' }"
    />
  </span>
</template>
