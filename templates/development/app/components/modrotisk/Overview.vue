<script setup lang="ts">
// The building at a glance in Blueprint: its sheet with the elevation drawn from the flats.
// (Blueprint's own page puts the elevation in the price list; this is for a page that has this
// block, which then takes the elevation out of the price list.)
import type { Flat, Floor } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'overview'>; first?: boolean; index?: number; anchor?: string; flats: Flat[]; floors: Floor[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-5">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-6 text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
      <p v-if="block.text" class="lg:col-span-5 lg:col-start-8 text-quiet self-end">{{ tidyText(block.text) }}</p>
    </div>
    <ModrotiskElevation class="mt-12 lg:mt-14" :flats="flats" :floors="floors" />
  </section>
</template>
