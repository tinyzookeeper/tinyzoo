<script setup lang="ts">
// Talíř's gallery: a grid of squares with the bar and the last picture across two columns, and
// food photographed from above cut into plates.
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string; photos: Array<{ image: CmsMedia; caption: string; overhead: boolean }>; link?: string }>()
// (the first and the last picture hang across two columns)
const wide = (i: number, count: number) => i === 0 || i === count - 1
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <component :is="first ? 'h1' : 'h2'" class="wide text-[2.5rem] lg:text-[4.4rem]"><KitMarked :text="block.heading" plain /></component>
      <a v-if="link && block.linkLabel" class="ulink font-bold pb-2" :href="link" target="_blank" rel="noopener">{{ block.linkLabel }}</a>
    </div>
    <div class="mt-9 lg:mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
      <template v-for="(p, i) in photos" :key="i">
        <div v-if="wide(i, photos.length)" class="col-span-2 relative aspect-[3/2] lg:aspect-auto"><CmsImage :media="p.image" sizes="(min-width: 1024px) 40vw, 100vw" class="lg:absolute inset-0 w-full h-full object-cover" /></div>
        <CmsImage v-else :media="p.image" sizes="(min-width: 1024px) 20vw, 50vw" :class="p.overhead ? 'plate' : 'w-full aspect-square object-cover'" />
      </template>
    </div>
  </section>
</template>
