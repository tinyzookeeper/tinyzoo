<script setup lang="ts">
// Výkres's clients' words: three columns divided by hairlines, each a quotation in the light
// expanded family with the name and what was built under it.
import type { Testimonial } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28">
    <div class="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
      <div>
        <p v-if="block.eyebrow" class="lab mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px]"><KitMarked :text="block.heading" as="span" /></component>
      </div>
    </div>
    <div class="grid md:grid-cols-3">
      <figure v-for="(t, i) in items" :key="t.id" class="border-b border-hair py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
        <blockquote class="font-display text-[18px] font-light leading-[1.55] tracking-[-.01em] text-ink">„{{ tidyText(t.text) }}“</blockquote>
        <figcaption class="mt-6"><span class="block font-medium text-ink">{{ t.name }}</span><span v-if="t.place || t.built" class="lab mt-1 block">{{ [t.place, t.built].filter(Boolean).join(' · ') }}</span></figcaption>
      </figure>
    </div>
  </section>
</template>
