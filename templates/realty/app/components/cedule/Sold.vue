<script setup lang="ts">
// Cedule's sold section: the heading and a line of text over a black rule, then up to three
// columns divided by rules, each with what was sold in mono, the number of days set enormous,
// what the client said and who said it.
import type { Sale } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'sold'>; first?: boolean; anchor?: string; sales: Sale[] }>()
const w = useSiteWords().value.cedule
const shown = computed(() => props.sales.slice(0, 3))
const edge = (i: number) => (shown.value.length < 2 ? 'py-7 md:py-8 border-b-2 md:border-b-0 border-ink' : i === 0 ? 'py-7 md:py-8 md:pr-8 border-b-2 md:border-b-0 border-ink' : i === shown.value.length - 1 ? 'py-7 md:py-8 md:pl-8 md:border-l-2 border-ink' : 'py-7 md:py-8 md:px-8 border-b-2 md:border-b-0 md:border-l-2 border-ink')
</script>

<template>
  <section :id="anchor" class="wrap py-14 md:py-24">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="mono caps mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[3.2rem] md:text-[5rem] tracking-[-0.05em] leading-[0.9]"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-5 text-[1.1rem] font-medium max-w-[30rem]">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-8 grid md:grid-cols-3 border-t-2 border-ink">
      <figure v-for="(s, i) in shown" :key="s.id" class="flex flex-col" :class="edge(i)">
        <p class="mono caps">{{ [s.what, s.place].filter(Boolean).join(w.sep) }}</p>
        <p class="mt-4 font-extrabold text-[5rem] md:text-[6.5rem] leading-[0.85] tracking-[-0.06em] num">{{ durationParts(s.duration)[0] }}<span class="text-[0.36em] tracking-[-0.03em] ml-2">{{ durationParts(s.duration)[1] }}</span></p>
        <blockquote v-if="s.quote" class="mt-6 text-[1.08rem] leading-[1.5] font-medium">„{{ tidyText(s.quote) }}“</blockquote>
        <figcaption v-if="s.client" class="mt-auto pt-5 mono caps text-quiet">{{ tidyText(s.client) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
