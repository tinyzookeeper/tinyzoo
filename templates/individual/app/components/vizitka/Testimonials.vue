<script setup lang="ts">
// Vizitka's testimonials: on the brand colour, the first one large in italics and the others
// in two columns under a rule. The heading is the small capitals line above them.
import type { Testimonial } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
</script>

<template>
  <section :id="anchor" class="bg-brand text-brand-ink on-brand">
    <div class="wrap py-20 lg:py-28">
      <component :is="first ? 'h1' : 'h2'" class="label opacity-85 !text-brand-ink"><KitMarked :text="block.heading" plain /></component>
      <figure v-if="items[0]" class="mt-8 max-w-[62rem]">
        <blockquote class="serif italic text-[1.6rem] leading-[1.35] md:text-[2.25rem] md:leading-[1.3] tracking-[-0.01em]">„{{ czText(items[0].text) }}“</blockquote>
        <figcaption class="mt-7">
          <span class="font-semibold">{{ items[0].name }}</span><span v-if="items[0].role" class="opacity-85"> · {{ czText(items[0].role) }}</span>
        </figcaption>
      </figure>
      <div v-if="items.length > 1" class="mt-12 lg:mt-14 grid md:grid-cols-2 gap-x-16 gap-y-10 border-t border-brand-ink/30 pt-10">
        <figure v-for="t in items.slice(1)" :key="t.id">
          <blockquote class="serif text-[1.2rem] leading-[1.55]">„{{ czText(t.text) }}“</blockquote>
          <figcaption class="mt-5 text-[0.95rem]"><span class="font-semibold">{{ t.name }}</span><span v-if="t.role" class="opacity-85"> · {{ czText(t.role) }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
