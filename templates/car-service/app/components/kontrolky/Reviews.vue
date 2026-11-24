<script setup lang="ts">
// Kontrolky's reviews: two columns, each quote under a hairline, with the name and the car.
import type { Review } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; items: Review[] }>()
</script>

<template>
  <section class="wrap pb-16 lg:pb-28">
    <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
    <div class="mt-12 grid md:grid-cols-2 gap-x-16 gap-y-10">
      <figure v-for="r in items" :key="r.id" class="border-t border-line pt-7 flex flex-col">
        <blockquote class="text-[18px] leading-[1.65]">{{ tidyText(r.text) }}</blockquote>
        <figcaption class="mt-auto pt-6 leading-snug"><span class="block font-display font-semibold text-[19px]">{{ r.name }}</span><span class="text-[15.5px] text-quiet">{{ [r.car, r.year].filter(Boolean).join(', ') }}</span></figcaption>
      </figure>
    </div>
  </section>
</template>
