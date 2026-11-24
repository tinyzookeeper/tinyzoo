<script setup lang="ts">
// Šachovnice's reviews: three on black, side by side, each signed with a small brand-coloured square.
import type { Review } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; anchor?: string; items: Review[] }>()
</script>

<template>
  <section :id="anchor" class="on-ink bg-ink text-paper">
    <div class="wrap py-16 md:py-24">
      <component :is="first ? 'h1' : 'h2'" class="tag text-brand">{{ tidyText(block.heading) }}</component>
      <div class="mt-8 grid lg:grid-cols-3 gap-x-10 gap-y-12">
        <figure v-for="r in items.slice(0, 3)" :key="r.id" class="flex flex-col">
          <blockquote class="text-[22px] md:text-[24px] leading-[1.35] font-semibold">„{{ tidyText(r.text) }}“</blockquote>
          <figcaption class="mt-6 lg:mt-auto lg:pt-8 flex items-center gap-3"><span class="w-3 h-3 bg-brand" /><span class="font-display font-bold text-[14px]">{{ r.name }}</span><span v-if="r.about" class="opacity-80">{{ r.about }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
