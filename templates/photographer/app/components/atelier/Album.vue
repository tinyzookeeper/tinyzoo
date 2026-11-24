<script setup lang="ts">
// Ateliér's album page: the title in italics, when and where, then every photograph in a masonry.
import type { Album } from '../../lib/cms-content'

const props = defineProps<{ album: Album }>()
const { settings } = await useSite()
const words = useSiteWords()
// The photograph opened large (its place in the album), or none.
const shown = ref<number | null>(null)
const SHAPE = { wide: 'aspect-[3/2]', tall: 'aspect-[4/5]', square: 'aspect-square' }
const facts = computed(() => [formatDate(props.album.date), props.album.place, words.value.photos(props.album.photos.length)].filter(Boolean))
</script>

<template>
  <article>
    <section class="wrap pt-10 md:pt-16 pb-12 md:pb-16">
      <div class="grid md:grid-cols-12 gap-x-10 gap-y-6">
        <div class="md:col-span-7">
          <p class="label text-quiet mb-4"><NuxtLink class="hover:text-brand" :to="categoryHref(album.category)">{{ album.category.name }}</NuxtLink></p>
          <h1 class="text-[2.7rem] md:text-[4.2rem] leading-[1.02]"><em>{{ tidyText(album.title) }}</em></h1>
          <p class="label text-ink mt-5">{{ facts.join(' · ') }}</p>
        </div>
        <p v-if="album.summary" class="md:col-span-5 md:pt-10 max-w-[34rem]">{{ tidyText(album.summary) }}</p>
      </div>
    </section>

    <section class="wrap pb-16 md:pb-24">
      <div class="columns-2 md:columns-3 gap-x-4 md:gap-x-8 border-t border-line pt-8 md:pt-10">
        <figure v-for="(p, i) in album.photos" :key="p.id" class="break-inside-avoid mb-7 md:mb-11">
          <a :href="p.url" class="ph" data-photo @click.prevent="shown = i" :class="SHAPE[shapeOf(p).shape]">
            <CmsImage :media="p" sizes="(min-width: 1360px) 24rem, (min-width: 768px) 30vw, 46vw" />
          </a>
          <figcaption v-if="p.caption" class="pt-2.5 font-display text-ink text-[1.05rem] md:text-[1.2rem] leading-snug">{{ tidyText(p.caption) }}</figcaption>
        </figure>
      </div>

      <div class="mt-6 md:mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 border-t border-line pt-7">
        <p class="label"><NuxtLink class="tlink" :to="categoryHref(album.category)">{{ words.backToGallery }}</NuxtLink></p>
        <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn label shrink-0" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
    <PhotoLightbox v-model="shown" :photos="album.photos" />
  </article>
</template>
