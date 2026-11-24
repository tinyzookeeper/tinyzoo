<script setup lang="ts">
// Celý rok's gallery: a full-bleed mosaic whose pattern repeats after six photographs.
defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string }>()
const { words } = await useStay()
// The six places of the pattern (a twelve-column grid from `md`; two columns on a phone).
const CELLS = [
  'col-span-2 md:col-span-7 md:row-span-2 aspect-[3/2] md:aspect-auto',
  'col-span-2 md:col-span-5 aspect-[3/2] md:aspect-auto',
  'md:col-span-2 aspect-square md:aspect-auto',
  'md:col-span-3 md:row-span-2 row-span-2 md:aspect-auto',
  'md:col-span-4 aspect-square md:aspect-auto',
  'col-span-2 md:col-span-5 aspect-[3/2] md:aspect-auto',
]
</script>

<template>
  <section :id="anchor" class="pt-20 md:pt-24">
    <div class="wrap flex flex-wrap items-end justify-between gap-4">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <NuxtLink v-if="block.moreLabel && block.moreUrl" :to="siteHref(block.moreUrl)" class="tlink">{{ block.moreLabel }}<template v-if="block.moreCount">, {{ words.photosOf(block.moreCount) }}</template> <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
    </div>
    <div class="mt-10 grid grid-cols-2 md:grid-cols-12 gap-1 md:auto-rows-[15.5rem]">
      <template v-for="(p, i) in block.photos" :key="p.id">
        <component :is="block.moreUrl ? 'NuxtLink' : 'div'" v-if="p.image" :to="block.moreUrl ? siteHref(block.moreUrl) : undefined" class="ph" :class="CELLS[i % 6]">
          <CmsImage :media="p.image" sizes="(min-width: 768px) 60vw, 100vw" />
        </component>
      </template>
    </div>
  </section>
</template>
