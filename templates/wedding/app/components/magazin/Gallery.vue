<script setup lang="ts">
// Magazín's gallery: a masonry of mixed formats, each photograph in its own shape.
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string; photos: CmsMedia[] }>()
const SHAPE = { wide: 'aspect-[3/2]', tall: 'aspect-[4/5]', square: 'aspect-square' }
</script>

<template>
  <section :id="anchor" class="wrap pb-24 lg:pb-36">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-4 items-end border-t border-line pt-24 lg:pt-36">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-5"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="lg:col-span-4 lg:col-start-9 lg:pb-2">{{ tidyText(block.text) }}</p>
    </div>
    <div v-if="photos.length" class="columns-2 lg:columns-3 gap-3 sm:gap-6 lg:gap-10 mt-10 lg:mt-14 [&>figure]:break-inside-avoid [&>figure]:mb-3 sm:[&>figure]:mb-6 lg:[&>figure]:mb-10">
      <figure v-for="p in photos" :key="p.id" class="zoom" :class="SHAPE[shapeOf(p)]"><CmsImage :media="p" sizes="(min-width: 1024px) 26rem, 50vw" /></figure>
    </div>
  </section>
</template>
