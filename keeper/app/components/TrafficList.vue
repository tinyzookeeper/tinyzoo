<script setup lang="ts">
import type { TrafficItem } from '#keeper/types/traffic'

// One top list of the Traffic section (pages, sources, countries, devices): the name, its
// visitors, and a thin bar of its share against the first. A single series: one colour.
const props = defineProps<{ title: string; items: TrafficItem[]; kind?: 'page' | 'country' | 'plain' }>()

const max = computed(() => Math.max(1, ...props.items.map((i) => i.visitors)))
const countryName = (code: string) => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code }
  catch { return code }
}
const name = (i: TrafficItem) => (props.kind === 'country' ? countryName(i.value) : props.kind === 'page' ? (i.title || i.value) : i.value.charAt(0).toUpperCase() + i.value.slice(1))
</script>

<template>
  <div class="min-w-0">
    <h3 class="mb-2 flex items-baseline justify-between text-xs font-medium text-muted">
      <span>{{ title }}</span><span>Visitors</span>
    </h3>
    <p v-if="!items.length" class="text-sm text-muted">Nothing yet.</p>
    <ul v-else class="flex flex-col gap-1.5">
      <li v-for="i in items" :key="i.value" class="min-w-0">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="min-w-0 truncate text-highlighted" :title="kind === 'page' ? i.value : undefined">{{ name(i) }}</span>
          <span class="shrink-0 tabular text-toned">{{ i.visitors.toLocaleString('en-GB') }}</span>
        </div>
        <p v-if="kind === 'page' && i.title" class="truncate font-mono text-[11px] text-dimmed">{{ i.value }}</p>
        <div class="mt-1 h-1 rounded-full bg-(--ui-bg-elevated)">
          <div class="h-1 rounded-full bg-(--k-series-1)" :style="{ width: `${Math.max(2, (i.visitors / max) * 100)}%` }" />
        </div>
      </li>
    </ul>
  </div>
</template>
