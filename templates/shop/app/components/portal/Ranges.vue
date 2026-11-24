<script setup lang="ts">
// Portál's departments: six framed windows in three columns (photo, the name with its price
// range in brass, a sentence in italics, the makers). On a phone a small framed photo beside the text.
import type { Range } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'ranges'>; first?: boolean; anchor?: string; items: Range[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 pt-20 md:pt-28">
    <div class="mx-auto max-w-3xl text-center">
      <p v-if="block.eyebrow" class="caps text-brass">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="mx-auto mt-5 max-w-xl text-cream/80">{{ tidyText(block.text) }}</p>
    </div>
    <div class="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 md:mt-16 md:gap-y-16 lg:grid-cols-3">
      <article v-for="r in items" :key="r.id" class="flex gap-5 sm:block">
        <div class="frame w-28 shrink-0 self-start sm:w-auto"><CmsImage v-if="r.image" :media="r.image" sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 7rem" class="aspect-square object-cover sm:aspect-[4/3]" /></div>
        <div class="min-w-0 sm:mt-5">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 class="text-[1.45rem] md:text-[1.7rem]">{{ r.name }}</h3>
            <p class="fig whitespace-nowrap text-brass">{{ rangePrice(r.priceFrom, r.priceTo) }}</p>
          </div>
          <p v-if="r.text" class="voice mt-2 text-[1.08rem] leading-snug text-cream/90">„{{ tidyText(r.text) }}“</p>
          <p v-if="r.makers" class="mt-3 text-[0.9rem] text-cream/70">{{ tidyText(r.makers) }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
