<script setup lang="ts">
// Reflex's reviews: on black, the quotes in bold type in columns divided by heavy rules.
import type { Review } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'reviews'>; first?: boolean; items: Review[] }>()
// The first column has no padding on its left, the last none on its right.
const cell = (i: number) => {
  const last = i === props.items.length - 1
  return [i === 0 ? 'lg:pr-8' : last ? 'lg:pl-8' : 'lg:px-8', last ? '' : 'border-b-2 lg:border-b-0 lg:border-r-2 border-white/25'].join(' ')
}
</script>

<template>
  <section class="on-dark bg-ink text-white mt-1">
    <div class="wrap pt-16 md:pt-24 pb-16 md:pb-24">
      <p v-if="block.eyebrow" class="label text-brand-lit">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-10 md:mt-14 grid lg:grid-cols-3 border-t-2 border-white/25">
        <figure v-for="(r, i) in items" :key="r.id" class="flex flex-col py-7" :class="cell(i)">
          <blockquote class="text-[1.375rem] md:text-[1.5rem] leading-[1.28] font-bold tracking-[-0.015em]">„{{ tidyText(r.text) }}“</blockquote>
          <figcaption class="mt-auto pt-6 label"><span class="text-brand-lit">{{ r.name }}</span><template v-if="r.town"> · {{ r.town }}</template></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
