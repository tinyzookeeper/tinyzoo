<script setup lang="ts">
// Zvýrazňovač's testimonials: on the brand colour, one quote at poster size and the others
// smaller under a heavy rule. The heading is the mono line above them.
import type { Testimonial } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; anchor?: string; items: Testimonial[] }>()
</script>

<template>
  <section :id="anchor" class="bg-brand text-brand-ink">
    <div class="wrap py-20 lg:py-28">
      <component :is="first ? 'h1' : 'h2'" class="mono"><KitMarked :text="block.heading" plain /></component>
      <figure v-if="items[0]" class="mt-7">
        <blockquote class="font-extrabold text-[1.75rem] md:text-[2.6rem] lg:text-[3.3rem] tracking-[-0.04em] leading-[1.08] max-w-[30ch]">„{{ czText(items[0].text) }}“</blockquote>
        <figcaption class="mono mt-7">{{ items[0].name }}<template v-if="items[0].role"> · {{ czText(items[0].role) }}</template></figcaption>
      </figure>
      <div v-if="items.length > 1" class="mt-14 lg:mt-20 grid md:grid-cols-2 gap-x-10 gap-y-10">
        <figure v-for="t in items.slice(1)" :key="t.id" class="border-t-2 border-ink pt-6">
          <blockquote class="text-[1.25rem] lg:text-[1.4rem] leading-[1.4] font-medium max-w-[34rem]">„{{ czText(t.text) }}“</blockquote>
          <figcaption class="mono mt-5">{{ t.name }}<template v-if="t.role"> · {{ czText(t.role) }}</template></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
