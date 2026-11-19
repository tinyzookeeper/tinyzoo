<script setup lang="ts">
import type { SiteState } from '#keeper/types/keeper'

const props = defineProps<{ state: SiteState; since?: string | null }>()
const look = computed(() => ({
  up: { color: 'success' as const, label: 'Up' },
  down: { color: 'error' as const, label: 'Down' },
  unknown: { color: 'neutral' as const, label: 'Not checked yet' },
})[props.state])
const now = useNow()
</script>

<template>
  <UBadge :color="look.color" variant="soft" class="gap-1.5">
    <StateDot :state="state" size="sm" />
    {{ look.label }}<template v-if="since && state !== 'unknown'"> · {{ duration(since, null, now) }}</template>
  </UBadge>
</template>
