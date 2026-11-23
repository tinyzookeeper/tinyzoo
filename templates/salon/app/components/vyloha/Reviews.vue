<script setup lang="ts">
// Výloha's reviews: three centred quotes in the display face, brass rules between them.
import type { Review } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; anchor?: string; items: Review[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28">
    <component :is="first ? 'h1' : 'h2'" class="flanked caps text-brass">{{ tidyText(block.heading) }}</component>
    <div class="mt-10 grid lg:grid-cols-3 gap-y-12 lg:divide-x divide-brass/40">
      <figure v-for="r in items.slice(0, 3)" :key="r.id" class="lg:px-10 lg:first:pl-0 lg:last:pr-0 text-center flex flex-col">
        <blockquote class="font-display text-cream text-[23px] leading-[1.4]">„{{ tidyText(r.text) }}“</blockquote>
        <figcaption class="mt-6 lg:mt-auto lg:pt-6"><span class="caps !text-[12px] text-brass">{{ r.name }}</span><span v-if="r.about" class="block text-[15px] mt-1">{{ r.about }}</span></figcaption>
      </figure>
    </div>
  </section>
</template>
