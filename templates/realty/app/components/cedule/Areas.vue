<script setup lang="ts">
// Cedule's "where we work": the photograph of the region darkened under the places, set as
// huge words that run on across the page. A place with something on offer carries its number
// as a small raised figure; one taken on by arrangement is paler.
import type { Area } from '../../lib/cms-content'

type Place = Area & { count: number }
defineProps<{ block: BlockOf<'areas'>; first?: boolean; anchor?: string; places: Place[] }>()
</script>

<template>
  <section :id="anchor" class="on-dark relative bg-ink text-paper overflow-hidden border-y-2 border-ink">
    <CmsImage v-if="block.image" :media="block.image" sizes="100vw" class="absolute inset-0 w-full h-full object-cover" />
    <div class="absolute inset-0 bg-[#111110]/70" />
    <div class="wrap relative py-16 md:py-28">
      <p v-if="block.eyebrow" class="mono caps text-spark">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="sr-only"><KitMarked :text="block.heading" plain /></component>
      <ul class="mt-6 flex flex-wrap gap-x-5 md:gap-x-8 gap-y-1 font-extrabold text-[2.3rem] md:text-[4.4rem] lg:text-[5.2rem] leading-[1.02] tracking-[-0.05em] max-w-[76rem]">
        <li v-for="p in places" :key="p.id" :class="p.onRequest || !p.count ? 'text-paper/70' : ''">{{ p.name }}<sup v-if="!p.onRequest && p.count" class="mono font-normal tracking-normal text-[0.8rem] md:text-[1rem] text-spark -top-[1.4em] md:-top-[2.4em] ml-1">{{ p.count }}</sup></li>
      </ul>
      <p v-if="block.text" class="mt-8 text-[1.1rem] font-medium max-w-[34rem]">{{ tidyText(block.text) }}</p>
    </div>
  </section>
</template>
