<script setup lang="ts">
// Regál's news: a shelf whose rail carries the dates in big condensed figures.
import type { News } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'news'>; first?: boolean; anchor?: string; items: News[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 pt-16 md:pt-24">
    <div class="flex flex-wrap items-end justify-between gap-4 pb-8 md:pb-10">
      <component :is="first ? 'h1' : 'h2'" class="text-[2.3rem] font-bold tracking-[-0.035em] md:text-[3.5rem]"><KitMarked :text="block.heading" /></component>
      <NuxtLink v-if="block.moreLabel && block.moreUrl" :to="siteHref(block.moreUrl)" class="inline-flex min-h-11 items-center font-bold"><span class="ulink">{{ block.moreLabel }}</span></NuxtLink>
    </div>
    <div class="shelf sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="n in items" :key="n.id" class="bay !grid-rows-none !row-span-1 block">
        <div class="rail"><p class="num text-[2.1rem]"><time :datetime="dateParts(n.date)?.iso">{{ dateParts(n.date)?.day }}. {{ dateParts(n.date)?.monthNumber }}. {{ dateParts(n.date)?.year }}</time></p></div>
        <div class="talk"><h3 class="text-[1.35rem] !leading-[1.1] !tracking-[-0.02em]">{{ tidyText(n.title) }}</h3><p v-if="n.text" class="mt-2 text-[0.97rem] leading-snug">{{ tidyText(n.text) }}</p></div>
      </article>
    </div>
  </section>
</template>
