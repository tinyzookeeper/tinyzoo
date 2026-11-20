<script setup lang="ts">
import type { Health } from '#keeper/types/keeper'

// A workspace's or team's health in one dot: red with a site down, amber with one behind on
// tinyzoo, green otherwise, grey without sites.
const props = defineProps<{ health: Health }>()
const tone = computed(() => (props.health.down ? 'down' : props.health.behind ? 'behind' : props.health.sites ? 'up' : 'none'))
const label = computed(() => ({
  down: `${props.health.down} down`,
  behind: `${props.health.behind} behind on tinyzoo`,
  up: 'All up',
  none: 'No sites',
})[tone.value])
</script>

<template>
  <span
    class="inline-flex size-2 shrink-0 rounded-full"
    :class="{ 'bg-error ring-3 ring-error/15': tone === 'down', 'bg-warning': tone === 'behind', 'bg-success': tone === 'up', 'bg-(--ui-text-dimmed)/40': tone === 'none' }"
    role="img"
    :aria-label="label"
    :title="label"
  />
</template>
