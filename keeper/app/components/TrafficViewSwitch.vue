<script setup lang="ts">
import type { TrafficView } from '../composables/useTrafficView'

// Simple | Detailed: a small segmented switch in a Traffic header. Two toggle buttons, the one
// that is on says so (aria-pressed), and the choice is remembered (useTrafficView).
const view = defineModel<TrafficView>({ required: true })
const options: { value: TrafficView; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'detailed', label: 'Detailed' },
]
</script>

<template>
  <div role="group" aria-label="How much detail" class="inline-flex shrink-0 rounded-full bg-(--ui-bg-elevated) p-0.5 text-xs">
    <button
      v-for="o in options" :key="o.value" type="button" :aria-pressed="view === o.value"
      class="rounded-full px-3 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ui-primary)"
      :class="view === o.value ? 'bg-(--k-surface) text-highlighted shadow-xs' : 'text-muted hover:text-highlighted'"
      @click="view = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>
