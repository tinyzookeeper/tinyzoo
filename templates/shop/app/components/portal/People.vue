<script setup lang="ts">
// Portál's people: the shop's story and a sentence in the shopkeeper's voice, beside two framed portraits.
import type { Person } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'people'>; first?: boolean; anchor?: string; items: Person[] }>()
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-20 md:py-28">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="caps text-brass">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 text-cream/80">{{ tidyText(block.text) }}</p>
        <p v-if="block.quote" class="voice mt-7 text-[1.5rem] leading-snug text-brass">„{{ tidyText(block.quote) }}“</p>
      </div>
      <div class="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:gap-10">
        <article v-for="p in items" :key="p.id">
          <div class="frame"><CmsImage v-if="p.image" :media="p.image" sizes="(min-width: 1024px) 28rem, (min-width: 640px) 45vw, 100vw" class="aspect-[4/5] object-cover" /></div>
          <h3 class="mt-5 text-[1.6rem]">{{ p.name }}</h3>
          <p v-if="p.role" class="caps mt-2 text-brass">{{ p.role }}</p>
          <p v-if="p.text" class="mt-3 text-cream/80">{{ tidyText(p.text) }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
