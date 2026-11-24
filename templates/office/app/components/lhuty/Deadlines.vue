<script setup lang="ts">
// Lhůty's ruler of deadlines: the nearest ones hang on a 100-day scale from xl up, and make a
// plain list beside a strip of ticks on smaller screens. Which deadlines are still ahead
// depends on today, so the ruler is drawn once the page is mounted; the server draws it empty.
import type { Deadline } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'deadlines'>; first?: boolean; anchor?: string; items: Deadline[] }>()
const { words } = await useOffice()
const now = useToday()
const flags = computed(() => (now.value ? upcomingDeadlines(props.items, now.value, props.block.count ?? 0, words.value) : []))
const months = computed(() => (now.value ? rulerMonths(now.value, monthLabel) : []))
const legend = computed(() => (now.value ? legendOf(now.value) : null))
</script>

<template>
  <section :id="anchor" class="border-y border-ink bg-card">
    <div class="wrap py-6 xl:pt-6 xl:pb-5">
      <div class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <component :is="first ? 'h1' : 'h2'" class="label"><KitMarked :text="block.heading" plain /></component>
        <p v-if="legend" class="font-mono text-[12px] text-quiet"><span class="mr-2 inline-block h-[9px] w-[9px] rounded-full bg-signal align-baseline" />{{ words.todayIs(legend.weekday, legend.date) }}</p>
      </div>
      <ol class="ruler mt-5 xl:mt-6" data-ruler>
        <li v-for="f in flags" :key="f.id" class="flag" :style="{ '--n': f.n, '--lv': f.level }" data-flag><span class="num font-medium">{{ f.date }}</span> <span v-if="f.chip" class="chip ml-1">{{ f.chip }}</span><span class="mt-1 block text-ink/85">{{ tidyText(f.text) }}</span></li>
        <li v-for="m in months" :key="m.n" class="month" :style="{ '--n': m.n }" aria-hidden="true">{{ m.label }}</li>
        <li v-if="now" class="ruler-today" aria-hidden="true" />
      </ol>
      <p v-if="now && !flags.length" class="mt-5 text-[15px] text-quiet">{{ words.noDeadlines }}</p>
    </div>
  </section>
</template>
