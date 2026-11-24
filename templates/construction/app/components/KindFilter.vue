<script setup lang="ts">
// The filter of the projects by kind, the same in every look (each look's stylesheet draws
// `.filter`): all, then the kinds that exist. On a phone the buttons are a row to swipe
// (Embla), from a tablet up they stand in one row.
import type { Project } from '~/lib/cms-content'

const props = defineProps<{
  active: Project['kind'] | null
  kinds: Array<{ kind: Project['kind']; count: number }>
  total: number
  /** How the counts are written: small beside the name, in the label itself, or not at all. */
  counts?: 'sup' | 'plain' | 'none'
  /** The gap between the buttons, as the look has it: 4 px or 8 px. */
  gap?: 'sm' | 'md'
}>()
defineEmits<{ choose: [kind: Project['kind'] | null] }>()
const words = useSiteWords()
const count = (kind: Project['kind'] | null) => (kind === null ? props.total : props.kinds.find((k) => k.kind === kind)?.count ?? 0)
const label = (kind: Project['kind'] | null) => `${kind === null ? words.value.all : words.value.kinds[kind].many}${props.counts === 'plain' ? ` ${count(kind)}` : ''}`
</script>

<template>
  <UCarousel
    v-slot="{ item }" :items="[null, ...kinds.map((k) => k.kind)]" align="start" contain-scroll="trimSnaps" drag-free
    class="-mx-5 max-w-[100vw] md:mx-0 md:w-auto" :class="gap === 'md' ? 'pb-1' : ''" role="group" :aria-label="words.filterLabel"
    :ui="{ viewport: 'px-5 md:px-0', container: gap === 'md' ? 'items-start -ms-2' : 'items-start -ms-1', item: gap === 'md' ? 'basis-auto ps-2' : 'basis-auto ps-1' }"
  >
    <button type="button" class="filter" :aria-pressed="active === item" :data-filter="item ?? 'all'" @click="$emit('choose', item)">{{ label(item) }}<sup v-if="counts === 'sup'">{{ count(item) }}</sup></button>
  </UCarousel>
</template>
