<script setup lang="ts">
// Ode dveří's reviews: soft cards, each with the guest, the town, the month and the room.
import type { Review } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; anchor?: string; reviews: Review[] }>()
const { words } = await useStay()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28">
    <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
    <div class="mt-8 md:mt-12 grid md:grid-cols-3 gap-5">
      <figure v-for="r in reviews" :key="r.id" class="rounded-[24px] bg-soft p-6 md:p-8 flex flex-col">
        <blockquote class="text-lg leading-relaxed text-ink">{{ tidyText(r.text) }}</blockquote>
        <figcaption class="mt-auto pt-6">
          <span class="block font-semibold text-ink">{{ [r.name, r.town].filter(Boolean).join(', ') }}</span>
          <span class="text-sm text-quiet">{{ [stayedText(words, r.stayed), r.room && words.reviewRoom(words.kind[r.room.kind], r.room.name)].filter(Boolean).join(', ') }}</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>
