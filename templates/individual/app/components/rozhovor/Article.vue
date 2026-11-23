<script setup lang="ts">
// Rozhovor's article page: the date, the headline in the display face with the first lines
// under it and a rounded photograph, then the text in one column.
import type { Article } from '~/lib/cms-content'

defineProps<{ entry: Article }>()
const { settings, words } = await useProfile()
</script>

<template>
  <article>
    <section class="wrap pt-8 lg:pt-12 pb-10">
      <div class="max-w-[46rem]">
        <time :datetime="dateParts(entry.date)?.iso" class="kicker text-quiet">{{ shortDate(entry.date) }}</time>
        <h1 class="mt-3 text-[2.3rem] leading-[1.1] md:text-[3.2rem] tracking-[-0.03em]">{{ czText(entry.title) }}</h1>
        <p v-if="entry.excerpt" class="mt-6 text-[1.25rem] leading-[1.5]">{{ czText(entry.excerpt) }}</p>
      </div>
    </section>
    <section class="wrap pb-16 lg:pb-24">
      <div v-if="entry.image" class="ph aspect-[3/2] lg:max-h-[520px] w-full rounded-[1.75rem] md:rounded-[2.25rem] mb-12"><CmsImage :media="entry.image" eager sizes="(min-width: 1280px) 76rem, 100vw" /></div>
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <div class="mt-12 lg:mt-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <NuxtLink class="tlink" to="/blog"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToArticles }}</NuxtLink>
        <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn shrink-0" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }}</NuxtLink>
      </div>
    </section>
  </article>
</template>
