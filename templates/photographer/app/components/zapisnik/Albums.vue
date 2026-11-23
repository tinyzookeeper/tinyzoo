<script setup lang="ts">
// Zápisník's list of albums (the "All albums" block, and a category's page): folder tabs that
// lead to each category's page, the albums' covers as prints on the tinted page.
import type { Album, Category } from '~/lib/cms-content'

defineProps<{ eyebrow: string | null; heading: string; text: string | null; albums: Album[]; categories: Category[]; active: string | null; first?: boolean }>()
const words = useSiteWords()
const cover = (a: Album) => a.cover ?? a.photos[0] ?? null
</script>

<template>
  <section class="wrap pt-6 md:pt-10 pb-20 md:pb-28">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-3 items-end mb-8 md:mb-10">
      <div class="md:col-span-7">
        <p v-if="eyebrow" class="hand text-brand text-[1.8rem] md:text-[2rem] -rotate-1 origin-left mb-3">{{ eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.4rem] md:text-[3.6rem] leading-[1.06]"><KitMarked :text="heading" plain /></component>
      </div>
      <p v-if="text" class="md:col-span-5 max-w-[30rem]">{{ tidyText(text) }}</p>
    </div>

    <nav v-if="categories.length" class="flex gap-[3px] md:gap-1.5 pl-0 md:pl-3" :aria-label="words.categories">
      <NuxtLink class="ftab" :to="GALLERY_PATH" :aria-current="active === null ? 'page' : undefined">{{ words.all }}</NuxtLink>
      <NuxtLink v-for="c in categories" :key="c.id" class="ftab" :to="categoryHref(c)" :aria-current="active === c.id ? 'page' : undefined">{{ c.name }}</NuxtLink>
    </nav>
    <div class="bg-tint rounded-[18px] px-3.5 py-6 md:p-10 -mx-1.5 md:mx-0" :class="categories.length ? 'rounded-tl-none md:rounded-tl-[18px]' : ''">
      <div v-if="albums.length" class="prints">
        <NuxtLink v-for="a in albums" :key="a.id" :to="albumHref(a)" class="print" :style="{ '--ar': shapeOf(cover(a)).ratio }">
          <CmsImage v-if="cover(a)" :media="cover(a)" sizes="(min-width: 768px) 24rem, 60vw" />
          <span class="cap">{{ a.title }}</span>
        </NuxtLink>
      </div>
      <p v-else>{{ words.noAlbums }}</p>
    </div>
  </section>
</template>
