<script setup lang="ts">
// Cesta's reviews: white surfaces in two columns, the quote, the name and the car.
import type { Review } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; items: Review[] }>()
</script>

<template>
  <section class="bg-paper py-16 lg:py-24">
    <div class="wrap">
      <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-2 font-extrabold text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
      <div class="mt-12 grid md:grid-cols-2 gap-5 lg:gap-6">
        <figure v-for="r in items" :key="r.id" class="rounded-[28px] bg-white p-7 sm:p-10 flex flex-col">
          <blockquote class="text-[19px] leading-[1.6]">{{ tidyText(r.text) }}</blockquote>
          <figcaption class="mt-auto pt-7 leading-snug"><span class="block font-display font-bold text-[19px]">{{ r.name }}</span><span class="text-[16px] text-quiet">{{ [r.car, r.year].filter(Boolean).join(', ') }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
