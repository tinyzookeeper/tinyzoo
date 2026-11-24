<script setup lang="ts">
// Mistr's reviews: three quotes in a row between two hairlines, each signed under a rule.
import type { Review } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; items: Review[] }>()
</script>

<template>
  <section class="border-y border-line">
    <div class="wrap py-16 md:py-24">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-10 grid md:grid-cols-3 gap-x-10 lg:gap-x-14 gap-y-10">
        <figure v-for="r in items" :key="r.id" class="flex flex-col">
          <blockquote class="serif md:!text-[1.1875rem] text-ink pb-5">„{{ tidyText(r.text) }}“</blockquote>
          <figcaption class="mt-auto pt-4 border-t border-line text-[0.9375rem]"><span class="font-bold text-ink">{{ r.name }}</span><span v-if="r.town" class="text-quiet">, {{ r.town }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
