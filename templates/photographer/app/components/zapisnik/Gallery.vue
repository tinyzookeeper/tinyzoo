<script setup lang="ts">
// Zápisník's gallery: an album page with folder tabs, the prints laid in rows of one height,
// a handwritten caption on each.
const props = defineProps<{ block: BlockOf<'gallery'>; tiles: GalleryTile[]; albumCount: number; first?: boolean }>()
const words = useSiteWords()
const filter = useTileFilter(() => props.tiles)
</script>

<template>
  <section class="wrap pb-20 md:pb-28">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-3 items-end mb-8 md:mb-10">
      <div class="md:col-span-7">
        <p v-if="block.eyebrow" class="hand text-brand text-[1.8rem] md:text-[2rem] -rotate-1 origin-left mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.3rem] md:text-[3.3rem] leading-[1.08]"><KitMarked :text="block.heading" plain /></component>
      </div>
      <p v-if="block.text" class="md:col-span-5 max-w-[30rem]">{{ tidyText(block.text) }}</p>
    </div>

    <div v-if="filter.categories.value.length > 1" class="flex gap-[3px] md:gap-1.5 pl-0 md:pl-3" role="group" :aria-label="words.categories">
      <button class="ftab" type="button" :aria-pressed="filter.active.value === null" @click="filter.choose(null)">{{ words.all }} <small>{{ filter.total.value }}</small></button>
      <button v-for="c in filter.categories.value" :key="c.id" class="ftab" type="button" :aria-pressed="filter.active.value === c.id" @click="filter.choose(c.id)">{{ c.name }} <small>{{ c.count }}</small></button>
    </div>
    <div class="bg-tint rounded-[18px] rounded-tl-none md:rounded-tl-[18px] px-3.5 py-6 md:p-10 -mx-1.5 md:mx-0">
      <div class="prints">
        <NuxtLink v-for="t in tiles" v-show="filter.isShown(t)" :key="t.key" :to="albumHref(t.album)" class="print" :style="{ '--ar': t.ratio }">
          <CmsImage :media="t.media" sizes="(min-width: 768px) 24rem, 60vw" />
          <span class="cap">{{ t.caption ?? t.album.title }}</span>
        </NuxtLink>
      </div>
      <p v-if="block.allLabel && block.allUrl" class="mt-8 md:mt-10 flex flex-wrap items-center gap-x-5 gap-y-2">
        <NuxtLink class="btn btn-paper" :to="siteHref(block.allUrl)">{{ block.allLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
        <span v-if="albumCount > 1" class="hand text-ink text-[1.5rem]">{{ words.albumsNote(albumCount) }}</span>
      </p>
    </div>
  </section>
</template>
