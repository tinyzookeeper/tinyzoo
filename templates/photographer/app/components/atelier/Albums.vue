<script setup lang="ts">
// Ateliér's list of albums (the "All albums" block, and a category's page): the categories as
// serif tabs that lead to each category's page, the albums as covers in a masonry.
import type { Album, Category } from '~/lib/cms-content'

defineProps<{ eyebrow: string | null; heading: string; text: string | null; albums: Album[]; categories: Category[]; active: string | null; first?: boolean }>()
const words = useSiteWords()
const SHAPE = { wide: 'aspect-[3/2]', tall: 'aspect-[4/5]', square: 'aspect-square' }
const cover = (a: Album) => a.cover ?? a.photos[0] ?? null
</script>

<template>
  <section class="wrap pt-10 md:pt-16 pb-20 md:pb-32">
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-10 md:mb-14">
      <div>
        <p v-if="eyebrow" class="label text-quiet mb-3">{{ eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.4rem] md:text-[3.4rem] leading-none"><KitMarked :text="heading" /></component>
        <p v-if="text" class="mt-5 max-w-[34rem]">{{ tidyText(text) }}</p>
      </div>
      <nav v-if="categories.length" class="flex flex-wrap gap-x-7 gap-y-0" :aria-label="words.categories">
        <NuxtLink class="tab" :to="GALLERY_PATH" :aria-current="active === null ? 'page' : undefined">{{ words.all }}</NuxtLink>
        <NuxtLink v-for="c in categories" :key="c.id" class="tab" :to="categoryHref(c)" :aria-current="active === c.id ? 'page' : undefined">{{ c.name }}</NuxtLink>
      </nav>
    </div>

    <div v-if="albums.length" class="columns-2 md:columns-3 gap-x-4 md:gap-x-8 border-t border-line pt-8 md:pt-10">
      <figure v-for="a in albums" :key="a.id" class="break-inside-avoid mb-7 md:mb-11">
        <NuxtLink :to="albumHref(a)" class="ph" :class="SHAPE[shapeOf(cover(a)).shape]">
          <CmsImage v-if="cover(a)" :media="cover(a)" sizes="(min-width: 1360px) 24rem, (min-width: 768px) 30vw, 46vw" />
        </NuxtLink>
        <figcaption class="pt-2.5">
          <NuxtLink :to="albumHref(a)" class="block font-display text-ink text-[1.05rem] md:text-[1.2rem] leading-snug hover:text-brand">{{ tidyText(a.title) }}</NuxtLink>
          <span class="block label text-quiet mt-1">{{ a.category.name }}<span v-if="a.place" class="hidden md:inline"> · {{ a.place }}</span> · {{ words.photos(a.photos.length) }}</span>
        </figcaption>
      </figure>
    </div>
    <p v-else class="border-t border-line pt-8">{{ words.noAlbums }}</p>
  </section>
</template>
