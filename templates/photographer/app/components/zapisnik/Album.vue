<script setup lang="ts">
// Zápisník's album page: the title, when and where, then every photograph as a print on the
// tinted page.
import type { Album } from '../../lib/cms-content'

const props = defineProps<{ album: Album }>()
const { settings } = await useSite()
const words = useSiteWords()
// The photograph opened large (its place in the album), or none.
const shown = ref<number | null>(null)
const facts = computed(() => [props.album.place, words.value.photos(props.album.photos.length)].filter(Boolean))
</script>

<template>
  <article class="wrap pt-6 md:pt-10 pb-20 md:pb-28">
    <div class="max-w-[46rem] mb-10 md:mb-14">
      <p v-if="album.date" class="hand text-brand text-[1.8rem] md:text-[2rem] -rotate-1 origin-left mb-3">{{ formatDate(album.date) }}</p>
      <h1 class="text-[2.4rem] md:text-[3.6rem] leading-[1.06]">{{ tidyText(album.title) }}</h1>
      <p class="mt-4 font-bold text-ink"><NuxtLink class="ulink" :to="categoryHref(album.category)">{{ album.category.name }}</NuxtLink><template v-if="facts.length"> · {{ facts.join(' · ') }}</template></p>
      <p v-if="album.summary" class="mt-5 max-w-[36rem]">{{ tidyText(album.summary) }}</p>
    </div>

    <div class="bg-tint rounded-[18px] px-3.5 py-6 md:p-10 -mx-1.5 md:mx-0">
      <div class="prints">
        <a v-for="(p, i) in album.photos" :key="p.id" :href="p.url" class="print" data-photo @click.prevent="shown = i" :class="p.caption ? '' : 'bare'" :style="{ '--ar': shapeOf(p).ratio }">
          <CmsImage :media="p" sizes="(min-width: 768px) 24rem, 60vw" />
          <span v-if="p.caption" class="cap">{{ p.caption }}</span>
        </a>
      </div>
    </div>

    <p class="mt-10 md:mt-12 flex flex-wrap items-center gap-x-7 gap-y-3">
      <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }}</NuxtLink>
      <NuxtLink class="ulink inline-flex items-center min-h-[44px]" :to="categoryHref(album.category)">{{ words.backToGallery }}</NuxtLink>
    </p>
    <PhotoLightbox v-model="shown" :photos="album.photos" />
  </article>
</template>
