<script setup lang="ts">
// Negativ's album page: the title in huge capitals, when and where as a small table, then
// every photograph in the mosaic.
import type { Album } from '~/lib/cms-content'

const props = defineProps<{ album: Album }>()
const { settings } = await useSite()
const words = useSiteWords()
const facts = computed(() => [
  props.album.date ? { label: 'Kdy', value: formatDate(props.album.date) } : null,
  props.album.place ? { label: 'Kde', value: props.album.place } : null,
  { label: 'Snímků', value: String(props.album.photos.length) },
].filter((f): f is { label: string; value: string } => !!f))
const size = computed(() => byLength(props.album.title, [
  [14, 'text-[19vw] md:text-[11vw] wide:text-[min(11vw,11rem)]'],
  [26, 'text-[14vw] md:text-[8vw] wide:text-[min(8vw,8rem)]'],
], 'text-[11vw] md:text-[6vw] wide:text-[min(6vw,6rem)]'))
</script>

<template>
  <article>
    <section class="pad pt-10 md:pt-16 pb-9 md:pb-14">
      <div class="grid md:grid-cols-12 gap-x-10 gap-y-6 items-end">
        <div class="md:col-span-8">
          <p class="m text-brand mb-4"><NuxtLink class="hover:underline underline-offset-4" :to="categoryHref(album.category)">{{ album.category.name }}</NuxtLink></p>
          <h1 class="d" :class="size">{{ album.title }}</h1>
        </div>
        <dl class="md:col-span-4 m grid grid-cols-[5.5rem_1fr] gap-y-1.5 border-t border-rule pt-4">
          <template v-for="f in facts" :key="f.label">
            <dt class="text-dim">{{ f.label }}</dt><dd>{{ f.value }}</dd>
          </template>
        </dl>
      </div>
      <p v-if="album.summary" class="mt-9 md:mt-12 text-[1.3rem] md:text-[1.65rem] leading-[1.3] font-medium max-w-[46rem]">{{ tidyText(album.summary) }}</p>
    </section>

    <div class="mosaic">
      <a v-for="(p, i) in album.photos" :key="p.id" :href="p.url" class="tile" :class="shapeOf(p).shape === 'wide' ? 'w2' : ''">
        <CmsImage :media="p" sizes="(min-width: 1100px) 40vw, (min-width: 768px) 67vw, 100vw" />
        <span class="chip m">{{ String(i + 1).padStart(2, '0') }}</span>
        <span v-if="p.caption" class="cap"><span class="block font-semibold text-[1.05rem] leading-tight">{{ p.caption }}</span></span>
      </a>
    </div>

    <section class="pad flex flex-col md:flex-row md:items-center md:justify-between gap-5 py-9 md:py-12">
      <NuxtLink class="lnk m" :to="categoryHref(album.category)"><UIcon name="i-lucide-arrow-left" class="mr-2 size-3.5" aria-hidden="true" /> {{ words.backToGallery }}</NuxtLink>
      <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn m !font-medium" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
    </section>
  </article>
</template>
