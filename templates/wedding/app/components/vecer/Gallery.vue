<script setup lang="ts">
// Večer's gallery: four portraits, every other one set lower; a row to swipe on a phone.
import type { CmsMedia } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string; photos: CmsMedia[] }>()
const { names, words } = await useWedding()
</script>

<template>
  <section :id="anchor" class="pb-24 lg:pb-36">
    <div class="wrap">
      <div class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-line pt-16 lg:pt-24">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="italic">{{ tidyText(block.text) }}</p>
      </div>
    </div>
    <div v-if="photos.length" class="lg:max-w-[78rem] lg:mx-auto lg:px-12 mt-10 lg:mt-14" role="group" :aria-label="words.photosOf(names)">
      <UCarousel
        v-slot="{ item, index }" :items="photos" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ viewport: 'px-6 lg:px-0', container: 'items-start -ms-4 lg:-ms-7', item: 'basis-[72%] sm:basis-[44%] lg:basis-0 lg:grow ps-4 lg:ps-7' }"
      >
        <figure class="zoom aspect-[3/4]" :class="index % 2 ? 'lg:mt-14' : ''"><CmsImage :media="item" sizes="(min-width: 1024px) 30rem, 120vw" /></figure>
      </UCarousel>
    </div>
  </section>
</template>
