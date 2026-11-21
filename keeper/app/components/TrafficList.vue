<script setup lang="ts">
import type { TrafficItem, TrafficSiteRef } from '#keeper/types/traffic'

// One top list (pages, sources, countries, devices): the name left, its visitors right, and a
// thin bar of its share against the first under the name. One series, one warm colour.
// Simple says things the way people do (page titles, "Typed the address", "Phone"); `detailed`
// keeps the plugin's names and shows a page's path. Across several sites (`sites`), a page
// says which site it is on.
type Item = TrafficItem & { site?: TrafficSiteRef }
const props = defineProps<{ title: string; items: Item[]; kind?: 'page' | 'source' | 'country' | 'device' | 'plain'; sites?: boolean; detailed?: boolean }>()

const max = computed(() => Math.max(1, ...props.items.map((i) => i.visitors)))
const countryName = (code: string) => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code }
  catch { return code }
}
const capital = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)
function name(i: Item): string {
  switch (props.kind) {
    case 'country': return countryName(i.value)
    case 'page': return i.title || (i.value === '/' ? 'Home page' : i.value)
    case 'source': return props.detailed ? i.value : simpleSource(i.value)
    case 'device': return props.detailed ? capital(i.value) : simpleDevice(i.value)
    default: return capital(i.value)
  }
}
/** The line under a page: its site (across sites) and, in Detailed, its path. */
const sub = (i: Item) => {
  if (props.kind !== 'page') return null
  const site = props.sites && i.site ? i.site.name : ''
  const path = props.detailed && i.title ? i.value : ''
  return site || path ? { site, path } : null
}
</script>

<template>
  <div class="min-w-0">
    <h3 class="mb-1.5 flex items-baseline justify-between text-xs font-medium text-muted">
      <span>{{ title }}</span><span v-if="detailed">Visitors</span>
    </h3>
    <p v-if="!items.length" class="text-sm text-muted">Nothing yet.</p>
    <ul v-else>
      <li v-for="i in items" :key="`${i.site?.id ?? ''}${i.value}`" class="k-row">
        <span class="min-w-0">
          <span class="block truncate" :title="kind === 'page' ? i.value : undefined">{{ name(i) }}</span>
          <span v-if="sub(i)" class="block truncate text-[11px] text-dimmed">
            <span v-if="sub(i)!.site" class="text-muted">{{ sub(i)!.site }}</span><template v-if="sub(i)!.site && sub(i)!.path"> · </template><span v-if="sub(i)!.path" class="font-mono">{{ sub(i)!.path }}</span>
          </span>
        </span>
        <span class="shrink-0 tabular text-toned">{{ i.visitors.toLocaleString('en-GB') }}</span>
        <span class="k-row__track" aria-hidden="true"><span class="k-row__bar" :style="{ width: `${(i.visitors / max) * 100}%` }" /></span>
      </li>
    </ul>
  </div>
</template>
