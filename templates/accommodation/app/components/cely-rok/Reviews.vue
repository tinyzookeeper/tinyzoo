<script setup lang="ts">
// Celý rok's reviews: three columns under hairlines, each with the guest, the month of the stay
// and the room, and the month marked on a small year.
import type { Review } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'reviews'>; first?: boolean; anchor?: string; reviews: Review[] }>()
const { words } = await useStay()
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-24">
    <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
    <div class="mt-10 md:mt-14 grid md:grid-cols-3 gap-x-10">
      <figure v-for="r in reviews" :key="r.id" class="rule py-7 flex flex-col">
        <blockquote class="text-lg leading-relaxed">{{ tidyText(r.text) }}</blockquote>
        <figcaption class="mt-auto pt-7">
          <p class="font-display text-xl">{{ r.name }}</p>
          <p class="text-sm text-quiet">{{ [r.town, stayedText(words, r.stayed), r.room && words.reviewRoom(words.kind[r.room.kind], r.room.name)].filter(Boolean).join(' · ') }}</p>
          <span v-if="stayedMonth(r.stayed)" class="mini mt-3" aria-hidden="true"><i v-for="m in 12" :key="m" :class="{ on: m === stayedMonth(r.stayed) }" /></span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>
