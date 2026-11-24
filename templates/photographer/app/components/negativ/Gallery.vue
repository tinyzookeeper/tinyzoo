<script setup lang="ts">
// Negativ's gallery: the category names are the headline and the filter, the photographs a
// full-bleed mosaic with frame numbers; a caption shows on hover (always on a touch screen).
const props = defineProps<{ block: BlockOf<'gallery'>; tiles: GalleryTile[]; albumCount: number; first?: boolean }>()
const words = useSiteWords()
const filter = useTileFilter(() => props.tiles)
</script>

<template>
  <section class="pt-14 md:pt-24">
    <div class="pad">
      <div class="flex items-baseline justify-between gap-6 m text-dim mb-4 md:mb-6">
        <component :is="first ? 'h1' : 'h2'"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.eyebrow">{{ block.eyebrow }}</p>
      </div>
      <p v-if="block.text" class="text-dim max-w-[34rem] mb-6 md:mb-8">{{ tidyText(block.text) }}</p>
      <div v-if="filter.categories.value.length > 1" class="d flex flex-wrap gap-x-[0.38em] gap-y-0 text-[15vw] md:text-[8.6vw] wide:text-[min(8.6vw,9rem)] mb-8 md:mb-12" role="group" :aria-label="words.categories">
        <button class="flt d" type="button" :aria-pressed="filter.active.value === null" @click="filter.choose(null)">{{ words.all }}<sup>{{ filter.total.value }}</sup></button>
        <button v-for="c in filter.categories.value" :key="c.id" class="flt d" type="button" :aria-pressed="filter.active.value === c.id" @click="filter.choose(c.id)">{{ c.name }}<sup>{{ c.count }}</sup></button>
      </div>
    </div>

    <div class="mosaic">
      <NuxtLink v-for="t in tiles" v-show="filter.isShown(t)" :key="t.key" :to="albumHref(t.album)" class="tile" :class="t.shape === 'wide' ? 'w2' : ''">
        <CmsImage :media="t.media" :sizes="t.shape === 'wide' ? '(min-width: 1100px) 40vw, (min-width: 768px) 67vw, 100vw' : '(min-width: 1100px) 20vw, (min-width: 768px) 34vw, 50vw'" />
        <span class="chip m">{{ frameCode(t) }}</span>
        <span class="cap">
          <span class="block font-semibold text-[1.05rem] leading-tight">{{ t.album.title }}</span>
          <span class="block m mt-1">{{ t.category.name }} · {{ t.caption ?? t.album.place }}</span>
        </span>
      </NuxtLink>
      <NuxtLink v-if="block.allLabel && block.allUrl" :to="siteHref(block.allUrl)" class="flex flex-col justify-between p-4 md:p-5 bg-brand text-brand-ink transition-colors hover:bg-fg hover:text-bg">
        <span class="m">{{ words.albums(albumCount) }}</span>
        <span class="d text-[11vw] md:text-[4.6vw] wide:text-[min(3.6vw,3.6rem)] flex items-end justify-between gap-2">{{ block.allLabel }} <UIcon name="i-lucide-arrow-up-right" class="size-[0.8em] shrink-0" aria-hidden="true" /></span>
      </NuxtLink>
    </div>
  </section>
</template>
