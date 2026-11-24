<script setup lang="ts">
// Paragon's gallery: prints in columns like a contact sheet, each with a typed caption in lower
// case; the ninth print is left out on a phone.
import type { CmsMedia } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string; photos: Array<{ image: CmsMedia; caption: string }>; link?: string }>()
// (print by print: its shape, so the columns fill evenly)
const SHAPES = ['aspect-[3/2]', 'aspect-[4/5]', 'aspect-square', 'aspect-[3/2]', 'aspect-[4/5]', 'aspect-square', 'aspect-[3/2]', 'aspect-square', 'aspect-square']
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28">
    <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
      <component :is="first ? 'h1' : 'h2'" class="h text-[2.5rem] sm:text-[3.3rem] lg:text-[4rem]"><KitMarked :text="block.heading" plain /></component>
      <a v-if="link && block.linkLabel" class="tlink font-bold pb-1" :href="link" target="_blank" rel="noopener">{{ block.linkLabel }} -&gt;</a>
    </div>
    <div class="mt-8 lg:mt-10 columns-2 lg:columns-3 gap-4 lg:gap-7 [&>figure]:mb-4 lg:[&>figure]:mb-7 [&>figure]:break-inside-avoid">
      <figure v-for="(p, i) in photos" :key="i" class="photo" :class="i === 8 ? 'max-lg:hidden' : ''">
        <CmsImage :media="p.image" sizes="(min-width: 1024px) 24rem, 50vw" class="w-full object-cover" :class="SHAPES[i] ?? 'aspect-square'" />
        <figcaption>{{ tidyText(p.caption) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
