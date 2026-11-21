<script setup lang="ts">
// A list of values with a bar for each (its share of the largest): pages, sources, countries.
// Each row is the label and its number, with a thin bar under them on a light track, and a
// little room between rows. Clicking a row filters the whole page by it; a page that is an entry
// also links to its editor. A page's address shows under its title only when `paths` is on.
import { compactNumber } from '../app/format'
import type { BarItem } from '../app/types'

const props = withDefaults(defineProps<{
  items: BarItem[]
  locale: string
  empty: string
  filterLabel: (label: string) => string
  openLabel?: string
  moreLabel: (count: number) => string
  lessLabel: string
  rows?: number
  /** Show a page's address under its title (the detailed view). */
  paths?: boolean
}>(), { rows: 8, paths: false })
const emit = defineEmits<{ select: [key: string] }>()

const all = ref(false)
const shown = computed(() => (all.value ? props.items : props.items.slice(0, props.rows)))
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>

<template>
  <div>
    <p v-if="!items.length" class="py-6 text-center text-sm text-muted">{{ empty }}</p>
    <ul v-else class="an-list">
      <li v-for="item in shown" :key="item.key" class="an-row group relative">
        <button
          type="button" class="an-pick cms-dense min-w-0 text-left text-sm"
          :title="item.detail" :aria-label="filterLabel(item.label)" @click="emit('select', item.key)"
        >
          <span class="an-pick__text">
            <span v-if="item.prefix" class="shrink-0" aria-hidden="true">{{ item.prefix }}</span>
            <span class="min-w-0">
              <span class="block truncate text-highlighted">{{ item.label }}</span>
              <span v-if="paths && item.sub" class="block truncate font-mono text-xs text-muted">{{ item.sub }}</span>
            </span>
          </span>
          <span class="an-track" aria-hidden="true"><span class="an-bar" :style="{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }" /></span>
        </button>
        <UButton
          v-if="item.to" :to="item.to" size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil-line"
          class="an-open shrink-0 opacity-70 group-hover:opacity-100 focus-visible:opacity-100" :aria-label="`${openLabel}: ${item.label}`" :title="openLabel"
        />
        <span class="an-num shrink-0 text-right text-sm tabular-nums text-highlighted">{{ compactNumber(item.value, locale) }}</span>
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
.an-list { display: flex; flex-direction: column; gap: 0.125rem; margin-inline: -0.5rem; }
.an-row {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.4375rem 0.5rem 0.5rem;
  border-radius: calc(var(--ui-radius) * 1.25);
  transition: background-color 0.15s ease;
}
.an-row:hover,
.an-row:focus-within { background: var(--ui-bg-muted); }
.an-pick {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  border-radius: var(--ui-radius);
}
.an-pick:focus-visible { outline: 2px solid var(--cms-accent-ring, var(--ui-primary)); outline-offset: 4px; }
.an-pick__text { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.an-track {
  display: block;
  height: 5px;
  border-radius: 9999px;
  background: var(--cms-an-track);
  overflow: hidden;
}
.an-bar {
  display: block;
  height: 100%;
  border-radius: 9999px;
  background: var(--cms-an-visitors);
  transition: width 0.2s ease;
}
.an-open { margin-top: -0.125rem; }
.an-num { min-width: 3rem; line-height: 1.25rem; }
/* .cms-dense keeps the admin's touch rule from centring the label; the row keeps a 44 px tap height itself. */
@media (pointer: coarse) {
  .an-pick { min-height: 2.75rem; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .an-bar, .an-row { transition: none; }
}
</style>
