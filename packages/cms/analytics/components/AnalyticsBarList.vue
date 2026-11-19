<script setup lang="ts">
// A list of values with a bar for each (its share of the largest): pages, sources, countries.
// Clicking a row filters the whole page by it; a page that is an entry also links to its editor.
// The bar is a wash of the visitors' hue behind the text, so the text keeps its contrast.
import { compactNumber } from '../app/format'
import type { BarItem } from '../app/types'

const props = withDefaults(defineProps<{ items: BarItem[]; locale: string; empty: string; filterLabel: (label: string) => string; openLabel?: string; moreLabel: (count: number) => string; lessLabel: string; rows?: number }>(), { rows: 8 })
const emit = defineEmits<{ select: [key: string] }>()

const all = ref(false)
const shown = computed(() => (all.value ? props.items : props.items.slice(0, props.rows)))
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>

<template>
  <div>
    <p v-if="!items.length" class="py-6 text-center text-sm text-muted">{{ empty }}</p>
    <ul v-else class="space-y-0.5">
      <li v-for="item in shown" :key="item.key" class="an-row group relative flex items-center gap-1 rounded">
        <span class="an-bar pointer-events-none absolute left-0 rounded" :style="{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }" aria-hidden="true" />
        <button
          type="button" class="an-pick cms-dense relative flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
          :title="item.detail" :aria-label="filterLabel(item.label)" @click="emit('select', item.key)"
        >
          <span v-if="item.prefix" class="shrink-0" aria-hidden="true">{{ item.prefix }}</span>
          <span class="min-w-0">
            <span class="block truncate text-highlighted">{{ item.label }}</span>
            <span v-if="item.sub" class="block truncate font-mono text-xs text-muted">{{ item.sub }}</span>
          </span>
        </button>
        <UButton
          v-if="item.to" :to="item.to" size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil-line"
          class="relative shrink-0 opacity-70 group-hover:opacity-100 focus-visible:opacity-100" :aria-label="`${openLabel}: ${item.label}`" :title="openLabel"
        />
        <span class="an-num relative shrink-0 pr-2 text-right text-sm font-medium tabular-nums text-highlighted">{{ compactNumber(item.value, locale) }}</span>
      </li>
    </ul>
    <UButton
      v-if="items.length > rows" class="mt-2" size="xs" variant="link" color="neutral"
      :label="all ? lessLabel : moreLabel(items.length)" @click="() => { all = !all }"
    />
  </div>
</template>

<style src="../app/analytics.css"></style>

<style scoped>
.an-num { width: 3.5rem; }
/* .cms-dense keeps the admin's touch rule from centring the label; the row keeps a 44 px tap height itself. */
@media (pointer: coarse) {
  .an-pick { min-height: 2.75rem; }
}
.an-bar {
  top: 0;
  bottom: 0;
  background: var(--cms-an-bar);
  transition: width 0.2s ease;
}
.an-row:hover .an-bar,
.an-row:focus-within .an-num { width: 3.5rem; }
/* .cms-dense keeps the admin's touch rule from centring the label; the row keeps a 44 px tap height itself. */
@media (pointer: coarse) {
  .an-pick { min-height: 2.75rem; }
}
.an-bar {
  top: 0;
  bottom: 0;
  background: var(--cms-an-bar-hover);
}
@media (prefers-reduced-motion: reduce) {
  .an-bar { transition: none; }
}
</style>
