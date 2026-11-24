<script setup lang="ts">
// Portál's news: dated columns on the darkest wood, the date in brass figures.
import type { News } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: News[] }>()
const dayOf = (iso: string) => { const d = dateParts(iso); return d ? `${d.day}. ${d.monthNumber}.` : '' }
</script>

<template>
  <section :id="anchor" class="scroll-mt-0 bg-wood-lo py-16 md:py-24">
    <div class="wrap">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p v-if="block.eyebrow" class="caps text-brass">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        </div>
        <NuxtLink v-if="block.moreLabel && block.moreUrl" :to="siteHref(block.moreUrl)" class="tlink inline-flex min-h-11 items-center text-brass">{{ block.moreLabel }}</NuxtLink>
      </div>
      <div class="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
        <article v-for="n in items" :key="n.id" class="border-t border-brass/35 py-6">
          <p class="fig text-[1.9rem] text-brass"><time :datetime="dateParts(n.date)?.iso">{{ dayOf(n.date) }}</time></p>
          <h3 class="mt-3 text-[1.3rem]">{{ tidyText(n.title) }}</h3>
          <p v-if="n.text" class="mt-2 text-[0.97rem] text-cream/80">{{ tidyText(n.text) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
