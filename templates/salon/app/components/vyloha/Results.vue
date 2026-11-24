<script setup lang="ts">
// Výloha's results: photographs in the window. Five framed pictures, every other one set lower;
// a row to swipe on a phone (the carousel switches itself off from `lg`, where a grid takes over).
import type { Result } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'results'>; first?: boolean; anchor?: string; items: Result[] }>()
// Every other photograph hangs lower on the grid.
const cards = computed(() => props.items.map((r, i) => ({ ...r, class: i % 2 ? 'lg:mt-10' : '' })))
</script>

<template>
  <section :id="anchor" class="pt-20 md:pt-28 scroll-mt-4">
    <div class="wrap">
      <component :is="first ? 'h1' : 'h2'" class="flanked caps text-brass">{{ tidyText(block.heading) }}</component>
    </div>
    <UCarousel
      v-slot="{ item }" :items="cards" align="center" contain-scroll="trimSnaps" :breakpoints="{ '(min-width: 1024px)': { active: false } }"
      class="mt-8"
      :ui="{ viewport: 'wrap lg:overflow-visible', container: '-ms-4 md:-ms-5 lg:ms-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:items-start', item: 'basis-[calc(66%+4.6px)] sm:basis-[calc(40%+9px)] ps-4 md:ps-5 lg:ps-0 lg:basis-auto' }"
    >
      <div class="frame"><div class="aspect-[3/4] overflow-hidden"><CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 1024px) 240px, (min-width: 640px) 40vw, 66vw" class="w-full h-full object-cover" /></div></div>
      <p class="mt-4 font-display text-[19px] leading-snug text-cream">{{ item.title }}</p>
      <p v-if="item.person" class="caps !text-[11px] text-brass mt-1">{{ firstName(item.person.name) }}</p>
    </UCarousel>
  </section>
</template>
