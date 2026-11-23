<script setup lang="ts">
// Negativ's testimonials: ruled rows, who on the left, what they said in large type.
import type { Testimonial } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; items: Testimonial[]; first?: boolean }>()
const quoted = (text: string) => `„${tidyText(text.replace(/^[„"“]+|[“"”]+$/g, ''))}“`
</script>

<template>
  <section class="pt-14 md:pt-24">
    <div v-if="block.heading || block.eyebrow" class="pad flex items-baseline justify-between gap-6 m text-dim mb-4">
      <component :is="first ? 'h1' : 'h2'"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.eyebrow">{{ block.eyebrow }}</p>
    </div>
    <div class="border-t border-rule">
      <figure v-for="t in items" :key="t.id" class="pad grid md:grid-cols-12 gap-x-10 gap-y-3 py-8 md:py-10 border-b border-rule">
        <figcaption class="md:col-span-3 m"><span class="block">{{ t.name }}</span><span v-if="t.occasion" class="block text-dim">{{ t.occasion }}</span></figcaption>
        <blockquote class="md:col-span-9 text-[1.45rem] md:text-[2.3rem] leading-[1.2] font-medium tracking-[-0.01em] max-w-[26em]">{{ quoted(t.text) }}</blockquote>
      </figure>
    </div>
  </section>
</template>
