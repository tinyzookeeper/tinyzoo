<script setup lang="ts">
// Oznámení's gallery: five matted photographs in one row, tall and square in turns; a row to
// swipe on a phone.
import type { CmsMedia } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string; photos: CmsMedia[] }>()
const { names, words } = await useWedding()
</script>

<template>
  <section :id="anchor" class="pb-20 lg:pb-28">
    <div class="wrap">
      <div class="orn" aria-hidden="true"><i /><svg width="9" height="9" viewBox="0 0 10 10"><path d="M5 0l5 5-5 5-5-5z" fill="currentColor" /></svg><i /></div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 mt-14 lg:mt-20">
        <component :is="first ? 'h1' : 'h2'" class="text-[2.2rem] lg:text-[2.8rem] leading-[1.1]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="italic">{{ tidyText(block.text) }}</p>
      </div>
    </div>
    <div v-if="photos.length" class="lg:max-w-[76rem] lg:mx-auto lg:px-10 mt-9" role="group" :aria-label="words.photosOf(names)">
      <UCarousel
        v-slot="{ item, index }" :items="photos" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ viewport: 'px-5 lg:px-0', container: 'items-center -ms-4 lg:-ms-6', item: 'basis-[68%] sm:basis-[42%] lg:basis-0 lg:grow ps-4 lg:ps-6' }"
      >
        <figure><div class="frame" :class="index % 2 ? 'aspect-[4/5] lg:aspect-square' : 'aspect-[4/5]'"><CmsImage :media="item" sizes="(min-width: 1024px) 24rem, 110vw" /></div></figure>
      </UCarousel>
    </div>
  </section>
</template>
