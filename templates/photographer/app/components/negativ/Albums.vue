<script setup lang="ts">
// Negativ's list of albums (the "All albums" block, and a category's page): the category
// names as large links, the albums as a mosaic of covers.
import type { Album, Category } from '~/lib/cms-content'

const props = defineProps<{ eyebrow: string | null; heading: string; text: string | null; albums: Album[]; categories: Category[]; active: string | null; first?: boolean }>()
const words = useSiteWords()
const cover = (a: Album) => a.cover ?? a.photos[0] ?? null
const no = (i: number) => String(i + 1).padStart(2, '0')
const size = computed(() => byLength(props.heading, [
  [10, 'text-[19vw] md:text-[11vw] wide:text-[min(11vw,11rem)]'],
  [22, 'text-[14vw] md:text-[8vw] wide:text-[min(8vw,8rem)]'],
], 'text-[11vw] md:text-[6vw] wide:text-[min(6vw,6rem)]'))
</script>

<template>
  <section class="pt-10 md:pt-16">
    <div class="pad grid md:grid-cols-12 gap-x-10 gap-y-5 items-end mb-6 md:mb-10">
      <div class="md:col-span-7">
        <p v-if="eyebrow" class="m text-brand mb-4">{{ eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="d" :class="size"><KitMarked :text="heading" plain /></component>
      </div>
      <p v-if="text" class="md:col-span-5 text-dim max-w-[30rem] md:pb-3">{{ tidyText(text) }}</p>
    </div>
    <nav v-if="categories.length" class="pad d flex flex-wrap gap-x-[0.5em] gap-y-0 text-[9vw] md:text-[3.6vw] wide:text-[min(3.6vw,3.6rem)] mb-6 md:mb-10" :aria-label="words.categories">
      <NuxtLink class="flt d" :to="GALLERY_PATH" :aria-current="active === null ? 'page' : undefined">{{ words.all }}</NuxtLink>
      <NuxtLink v-for="c in categories" :key="c.id" class="flt d" :to="categoryHref(c)" :aria-current="active === c.id ? 'page' : undefined">{{ c.name }}</NuxtLink>
    </nav>

    <div v-if="albums.length" class="mosaic">
      <NuxtLink v-for="(a, i) in albums" :key="a.id" :to="albumHref(a)" class="tile" :class="shapeOf(cover(a)).shape === 'wide' ? 'w2' : ''">
        <CmsImage v-if="cover(a)" :media="cover(a)" sizes="(min-width: 1100px) 40vw, (min-width: 768px) 67vw, 100vw" />
        <span class="chip m">{{ no(i) }}</span>
        <span class="cap">
          <span class="block font-semibold text-[1.05rem] leading-tight">{{ a.title }}</span>
          <span class="block m mt-1">{{ a.category.name }}<template v-if="a.place"> · {{ a.place }}</template> · {{ words.photos(a.photos.length) }}</span>
        </span>
      </NuxtLink>
    </div>
    <p v-else class="pad text-dim border-t border-rule pt-6 pb-16">{{ words.noAlbums }}</p>
  </section>
</template>
