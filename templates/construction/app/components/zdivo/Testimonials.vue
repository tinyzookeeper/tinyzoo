<script setup lang="ts">
// Zdivo's clients' words: three cards stepped like the end of an unfinished wall, each lower
// than the one before it.
import type { Testimonial } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
// (whole class names, so the stylesheet finds them)
const STEP = ['', 'md:mt-12', 'md:mt-24']
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28" :aria-labelledby="'testimonials-heading'">
    <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" id="testimonials-heading" class="h2" :class="block.eyebrow ? 'mt-2' : ''"><KitMarked :text="block.heading" as="span" /></component>
    <div class="mt-10 grid gap-2 md:grid-cols-3 md:items-start">
      <figure v-for="(t, i) in items" :key="t.id" class="rounded-[4px] bg-card p-6 sm:p-8" :class="STEP[i % 3]">
        <blockquote class="font-display text-[24px] font-medium italic leading-[1.2] text-ink">„{{ tidyText(t.text) }}“</blockquote>
        <figcaption class="mt-6 text-[15px]"><span class="block font-bold text-ink">{{ t.name }}</span><span v-if="t.place || t.built" class="text-quiet">{{ [t.place, t.built].filter(Boolean).join(' · ') }}</span></figcaption>
      </figure>
    </div>
  </section>
</template>
