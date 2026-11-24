<script setup lang="ts">
// Zápisník's testimonials: notes taped onto the tinted page, each a little askew.
import type { Testimonial } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'testimonials'>; items: Testimonial[]; first?: boolean }>()
const quoted = (text: string) => `„${tidyText(text.replace(/^[„"“]+|[“"”]+$/g, ''))}“`
const NOTE = [
  { cls: 'rotate-[-1.2deg]', tape: '-3deg' },
  { cls: 'rotate-[0.8deg] md:mt-10', tape: '4deg' },
  { cls: 'rotate-[-0.6deg] md:mt-3', tape: '-5deg' },
]
</script>

<template>
  <section class="bg-tint">
    <div class="wrap py-20 md:py-28">
      <p v-if="block.eyebrow" class="hand text-brand text-[1.8rem] md:text-[2rem] -rotate-1 origin-left mb-3">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="text-[2.3rem] md:text-[3.3rem] leading-[1.08] mb-10 md:mb-14 max-w-[40rem]"><KitMarked :text="block.heading" plain /></component>
      <div class="grid gap-7 md:gap-8 items-start" :class="items.length >= 3 ? 'md:grid-cols-3' : items.length === 2 ? 'md:grid-cols-2' : 'max-w-[34rem]'">
        <figure
          v-for="(t, i) in items" :key="t.id"
          class="relative bg-card p-7 md:p-8 shadow-[0_0_0_1px_rgba(22,28,25,.05),0_1px_2px_rgba(22,28,25,.12),0_14px_26px_-14px_rgba(22,28,25,.4)] tape" :class="NOTE[i % 3]!.cls" :style="{ '--tr': NOTE[i % 3]!.tape }"
        >
          <blockquote class="font-display text-ink text-[1.3rem] leading-[1.42]">{{ quoted(t.text) }}</blockquote>
          <figcaption class="mt-6"><span class="hand text-brand text-[1.9rem] block">{{ t.name }}</span><span v-if="t.occasion" class="block mt-1 text-[0.98rem]">{{ t.occasion }}</span></figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
