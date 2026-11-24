<script setup lang="ts">
// Harmonogram's clients' words: the first one set very large with the others stacked beside it,
// ruled by hairlines. The heading is a mono label.
import type { Testimonial } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28">
    <p v-if="block.eyebrow" class="mono mb-3">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="mono"><KitMarked :text="block.heading" as="span" /></component>
    <div class="mt-6 grid border-t border-line lg:grid-cols-12">
      <figure v-if="items[0]" class="border-b border-line py-8 lg:col-span-7 lg:border-b-0 lg:border-r lg:py-10 lg:pr-12">
        <blockquote class="text-[28px] font-bold leading-[1.15] tracking-[-.03em] text-text sm:text-[40px]">„{{ tidyText(items[0].text) }}“</blockquote>
        <figcaption class="mt-6"><span class="block font-bold text-text">{{ items[0].name }}</span><span v-if="items[0].place || items[0].built" class="mono mt-1 block">{{ [items[0].place, items[0].built].filter(Boolean).join(' · ') }}</span></figcaption>
      </figure>
      <div class="lg:col-span-5 lg:pl-12">
        <figure v-for="(t, i) in items.slice(1)" :key="t.id" class="py-8 lg:py-10" :class="i < items.length - 2 ? 'border-b border-line' : ''">
          <blockquote class="text-[19px] font-medium leading-[1.4] tracking-[-.01em] text-text">„{{ tidyText(t.text) }}“</blockquote>
          <figcaption class="mt-4"><span class="block font-bold text-text">{{ t.name }}</span><span v-if="t.place || t.built" class="mono mt-1 block">{{ [t.place, t.built].filter(Boolean).join(' · ') }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
