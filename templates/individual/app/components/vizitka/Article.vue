<script setup lang="ts">
// Vizitka's article page: the date, the headline in the serif and the first lines, then the
// text in one column (the photograph, when there is one, after the heading).
import type { Article } from '../../lib/cms-content'

defineProps<{ entry: Article }>()
const { settings, words } = await useProfile()
</script>

<template>
  <article>
    <section class="wrap pt-16 lg:pt-24 pb-10">
      <div class="max-w-[46rem]">
        <time :datetime="dateParts(entry.date)?.iso" class="label text-quiet">{{ shortDate(entry.date) }}</time>
        <h1 class="mt-4 text-[2.1rem] md:text-[3rem] leading-[1.12]">{{ czText(entry.title) }}</h1>
        <p v-if="entry.excerpt" class="mt-6 text-[1.2rem] leading-[1.55] text-ink">{{ czText(entry.excerpt) }}</p>
      </div>
    </section>
    <section class="wrap pb-16 lg:pb-24">
      <div v-if="entry.image" class="ph aspect-[3/2] lg:max-h-[520px] w-full mb-12"><CmsImage :media="entry.image" eager sizes="(min-width: 1280px) 76rem, 100vw" /></div>
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <div class="mt-12 lg:mt-16 pt-8 border-t border-ink flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <NuxtLink class="tlink" to="/blog"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToArticles }}</NuxtLink>
        <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn shrink-0" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }}</NuxtLink>
      </div>
    </section>
  </article>
</template>
