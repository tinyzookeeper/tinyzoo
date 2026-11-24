<script setup lang="ts">
// Ateliér's gallery: serif tabs with counts, photographs in a three-column masonry (two on a
// phone) in their own shapes, each with a title and where it is from.
const props = defineProps<{ block: BlockOf<'gallery'>; first?: boolean; tiles: GalleryTile[]; albumCount: number }>()
const words = useSiteWords()
const filter = useTileFilter(() => props.tiles)
const SHAPE = { wide: 'aspect-[3/2]', tall: 'aspect-[4/5]', square: 'aspect-square' }
</script>

<template>
  <section class="wrap pb-20 md:pb-32">
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-5 border-t border-line pt-8 md:pt-10 mb-10 md:mb-14">
      <div>
        <p v-if="block.eyebrow" class="label text-quiet mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.4rem] md:text-[3.4rem] leading-none"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[34rem]">{{ tidyText(block.text) }}</p>
      </div>
      <div v-if="filter.categories.value.length > 1" class="flex flex-wrap gap-x-7 gap-y-0" role="group" :aria-label="words.categories">
        <button class="tab" type="button" :aria-pressed="filter.active.value === null" @click="filter.choose(null)">{{ words.all }} <sup>{{ filter.total.value }}</sup></button>
        <button v-for="c in filter.categories.value" :key="c.id" class="tab" type="button" :aria-pressed="filter.active.value === c.id" @click="filter.choose(c.id)">{{ c.name }} <sup>{{ c.count }}</sup></button>
      </div>
    </div>

    <div class="columns-2 md:columns-3 gap-x-4 md:gap-x-8">
      <figure v-for="t in tiles" v-show="filter.isShown(t)" :key="t.key" class="break-inside-avoid mb-7 md:mb-11">
        <NuxtLink :to="albumHref(t.album)" class="ph" :class="SHAPE[t.shape]">
          <CmsImage :media="t.media" sizes="(min-width: 1360px) 24rem, (min-width: 768px) 30vw, 46vw" />
        </NuxtLink>
        <figcaption class="pt-2.5">
          <span class="block font-display text-ink text-[1.05rem] md:text-[1.2rem] leading-snug">{{ tidyText(t.caption ?? t.album.title) }}</span>
          <span class="block label text-quiet mt-1">{{ t.caption ? t.album.title : t.category.name }}<span v-if="t.album.place" class="hidden md:inline"> · {{ t.album.place }}</span></span>
        </figcaption>
      </figure>
    </div>

    <p v-if="block.allLabel && block.allUrl" class="mt-4 md:mt-6 text-center label">
      <NuxtLink class="tlink" :to="siteHref(block.allUrl)">{{ block.allLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
    </p>
  </section>
</template>
