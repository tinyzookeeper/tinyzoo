<script setup lang="ts">
// Salon's gallery: two hung rows on a desktop (the first and last picture of each row twice as
// wide), a row to swipe on a phone.
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string; photos: Array<{ image: CmsMedia; caption: string }>; link?: string }>()
// (picture by picture, in the desktop's grid: how wide it hangs and how tall it is)
const WIDTHS = ['md:col-span-2', '', '', '', '', 'md:col-span-2']
const HEIGHTS = ['md:h-[23rem]', 'md:h-[23rem]', 'md:h-[23rem]', 'md:h-[18rem]', 'md:h-[18rem]', 'md:h-[18rem]']
</script>

<template>
  <section :id="anchor" class="border-t border-line">
    <div class="wrap py-20 lg:py-24">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display text-[2.4rem] lg:text-[3.3rem] leading-[1.08] tracking-[-.01em]"><KitMarked :text="block.heading" /></component>
        </div>
        <a v-if="link && block.linkLabel" class="link text-[1.08rem] py-2" :href="link" target="_blank" rel="noopener">{{ block.linkLabel }}</a>
      </div>

      <!-- a swipe row on a phone -->
      <UCarousel
        v-slot="{ item }" :items="photos" align="start" contain-scroll="trimSnaps" drag-free class="md:hidden -mx-5 mt-10"
        :ui="{ viewport: 'px-5', container: 'items-start -ms-3', item: 'basis-[76.8%] ps-3' }"
      >
        <figure><CmsImage :media="item.image" sizes="76vw" class="w-full aspect-[4/5] object-cover" /><figcaption class="mt-3 italic text-quiet">{{ tidyText(item.caption) }}</figcaption></figure>
      </UCarousel>
      <!-- two hung rows on a desktop -->
      <div class="max-md:hidden md:grid md:grid-cols-4 md:gap-x-6 md:gap-y-10 mt-12">
        <figure v-for="(p, i) in photos" :key="i" :class="WIDTHS[i]">
          <CmsImage :media="p.image" :sizes="i === 0 || i === 5 ? '(min-width: 1240px) 600px, 50vw' : '(min-width: 1240px) 300px, 25vw'" class="w-full object-cover" :class="HEIGHTS[i]" />
          <figcaption class="mt-3 italic text-quiet">{{ tidyText(p.caption) }}</figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
