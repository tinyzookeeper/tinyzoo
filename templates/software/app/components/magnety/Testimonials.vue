<script setup lang="ts">
// Magnets' testimonials: a question as the heading, and a tile for each quote with a round
// portrait that hangs over its top edge.
import type { Testimonial } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
const size = computed(() => byLength(props.block.heading, [[18, 'text-[44px] sm:text-[64px] lg:text-[84px]'], [34, 'text-[36px] sm:text-[48px] lg:text-[64px]']], 'text-[30px] sm:text-[40px] lg:text-[52px]'))
</script>

<template>
  <section :id="anchor" class="wrap py-14 lg:py-24">
    <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="q mt-4 max-w-[16ch]" :class="size"><KitMarked :text="block.heading" /></component>
    <div class="mt-10 grid gap-10 md:grid-cols-3 md:gap-5 lg:mt-14">
      <figure v-for="t in items" :key="t.id" class="tile relative bg-board p-6 pt-14 lg:p-8 lg:pt-16">
        <CmsImage v-if="t.photo" :media="t.photo" sizes="6rem" class="absolute -top-8 left-6 h-[88px] w-[88px] rounded-full border-4 border-cream object-cover lg:left-8" />
        <blockquote class="font-display text-[22px] font-medium leading-[1.25] tracking-[-0.01em] lg:text-[24px]">„{{ tidyText(t.text) }}“</blockquote>
        <figcaption class="mt-6 text-[15px] leading-snug"><b class="font-semibold">{{ t.name }}</b><template v-if="t.role"><br>{{ tidyText(t.role) }}</template></figcaption>
      </figure>
    </div>
  </section>
</template>
