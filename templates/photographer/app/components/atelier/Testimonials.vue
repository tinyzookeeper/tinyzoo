<script setup lang="ts">
// Ateliér's testimonials: the first one large and centred, the others in two columns under a hairline.
import type { Testimonial } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'testimonials'>; first?: boolean; items: Testimonial[] }>()
const first = computed(() => props.items[0]!)
const rest = computed(() => props.items.slice(1))
const quoted = (text: string) => `„${tidyText(text.replace(/^[„"“]+|[“"”]+$/g, ''))}“`
</script>

<template>
  <section class="bg-tint">
    <div class="wrap py-20 md:py-28">
      <p v-if="block.eyebrow" class="label text-quiet text-center mb-3">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="label !font-sans !font-medium !tracking-[0.18em] !text-quiet text-center mb-8 md:mb-10"><KitMarked :text="block.heading" plain /></component>
      <figure class="max-w-[58rem] mx-auto text-center">
        <blockquote class="font-display text-ink text-[1.7rem] md:text-[2.7rem] leading-[1.22] tracking-[-0.01em]"><em>{{ quoted(first.text) }}</em></blockquote>
        <figcaption class="mt-6 label text-ink">{{ first.name }} <span v-if="first.occasion" class="text-quiet">· {{ tidyText(first.occasion) }}</span></figcaption>
      </figure>
      <div v-if="rest.length" class="grid md:grid-cols-2 gap-x-16 gap-y-10 mt-14 md:mt-20 pt-10 md:pt-12 border-t border-line max-w-[64rem] mx-auto">
        <figure v-for="t in rest" :key="t.id">
          <blockquote class="font-display text-ink text-[1.3rem] md:text-[1.45rem] leading-[1.4]">{{ quoted(t.text) }}</blockquote>
          <figcaption class="mt-4 label text-ink">{{ t.name }} <span v-if="t.occasion" class="text-quiet">· {{ tidyText(t.occasion) }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
