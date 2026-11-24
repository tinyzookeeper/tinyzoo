<script setup lang="ts">
// Šanony's deadlines: no ruler, heavy ruled rows like its list of articles: the date, what is due
// and, for the nearest ones, a brand-coloured tag. Which deadlines are still ahead depends on
// today, so the rows are drawn once the page is mounted; the server draws none.
import type { Deadline } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'deadlines'>; first?: boolean; anchor?: string; items: Deadline[] }>()
const { words } = await useOffice()
const now = useToday()
const flags = computed(() => (now.value ? upcomingDeadlines(props.items, now.value, props.block.count ?? 0, words.value) : []))
const legend = computed(() => (now.value ? legendOf(now.value) : null))
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-28">
    <component :is="first ? 'h1' : 'h2'" class="display" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
    <p v-if="legend" class="kicker mt-4 text-[13px]">{{ words.todayIs(legend.weekday, legend.date) }}</p>
    <ol class="mt-10 border-t-4 border-ink" data-ruler>
      <li v-for="(f, i) in flags" :key="f.id" class="grid items-baseline gap-x-8 gap-y-1 py-5 lg:grid-cols-[170px_1fr_auto]" :class="i === flags.length - 1 ? 'border-b-4 border-ink' : 'border-b-2 border-ink'" data-flag>
        <span class="font-display text-[19px] font-bold">{{ f.date }}</span>
        <span class="font-display text-[22px] font-bold leading-[1.15] tracking-[-0.015em] sm:text-[26px]">{{ tidyText(f.text) }}</span>
        <span v-if="f.chip" class="kicker justify-self-start rounded-[3px] bg-brand px-2 py-1 text-[12px] text-brand-ink">{{ f.chip }}</span>
      </li>
    </ol>
    <p v-if="now && !flags.length" class="mt-5 text-[15px]">{{ words.noDeadlines }}</p>
  </section>
</template>
