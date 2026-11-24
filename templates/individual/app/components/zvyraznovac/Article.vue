<script setup lang="ts">
// Zvýrazňovač's article page: the date in mono, the headline in the heavy type with the first
// lines under it, then the text in one column.
import type { Article } from '../../lib/cms-content'

defineProps<{ entry: Article }>()
const { settings, words } = await useProfile()
</script>

<template>
  <article>
    <section class="wrap pt-16 lg:pt-24 pb-10 lg:pb-14">
      <time :datetime="dateParts(entry.date)?.iso" class="mono text-quiet">{{ shortDate(entry.date) }}</time>
      <h1 class="mt-5 text-[2.4rem] md:text-[3.6rem] lg:text-[4.8rem] tracking-[-0.05em] max-w-[22ch]">{{ czText(entry.title) }}</h1>
      <p v-if="entry.excerpt" class="mt-8 text-[1.2rem] lg:text-[1.35rem] leading-[1.4] font-medium max-w-[36rem]">{{ czText(entry.excerpt) }}</p>
    </section>
    <section class="wrap pb-16 lg:pb-24">
      <div v-if="entry.image" class="bw aspect-[3/2] lg:max-h-[520px] w-full mb-12"><CmsImage :media="entry.image" eager sizes="(min-width: 1440px) 86rem, 100vw" /></div>
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <div class="mt-12 lg:mt-16 border-t-2 border-ink pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <NuxtLink class="ulink" to="/blog"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToArticles }}</NuxtLink>
        <NuxtLink v-if="settings?.ctaLabel && settings.ctaUrl" class="btn shrink-0" :to="siteHref(settings.ctaUrl)">{{ settings.ctaLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
  </article>
</template>
