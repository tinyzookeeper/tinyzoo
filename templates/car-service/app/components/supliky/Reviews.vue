<script setup lang="ts">
// Šuplíky's reviews: lacquered slabs in two columns, each headed by the car on a number plate.
import type { Review } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; items: Review[] }>()
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <p v-if="block.eyebrow" class="kicker text-brand">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[42px] sm:text-[60px]">{{ plainEmphasis(block.heading) }}</component>
    <div class="mt-10 grid md:grid-cols-2 gap-x-6 gap-y-7">
      <figure v-for="r in items" :key="r.id" class="slab p-6 sm:p-8 flex flex-col items-start">
        <span class="spz"><span>{{ [r.car, r.year].filter(Boolean).join(' · ') }}</span></span>
        <blockquote class="mt-5 text-[18px] leading-[1.55]">{{ tidyText(r.text) }}</blockquote>
        <figcaption class="mt-auto pt-5 font-display italic font-bold text-[21px]">{{ r.name }}</figcaption>
      </figure>
    </div>
  </section>
</template>
