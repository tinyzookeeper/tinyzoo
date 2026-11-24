<script setup lang="ts">
// Šanony's page of one article: a heavy title, the date, the short text and the article between
// heavy rules.
import type { Article } from '../../lib/cms-content'

defineProps<{ entry: Article }>()
const { words, cta } = await useOffice()
</script>

<template>
  <article>
    <section class="wrap pb-10 pt-6 lg:pb-14 lg:pt-10">
      <p class="kicker"><NuxtLink class="navlink" to="/clanky">{{ words.backToArticles }}</NuxtLink></p>
      <h1 class="display mt-5 text-[40px] sm:text-[60px] xl:text-[72px]">{{ tidyText(entry.title) }}</h1>
      <p v-if="entry.date" class="mt-6 font-display text-[19px] font-bold"><time :datetime="dateParts(entry.date)?.iso">{{ numericDate(entry.date) }}</time></p>
      <p v-if="entry.summary" class="mt-4 max-w-[58ch] text-[19px] leading-[1.55]">{{ tidyText(entry.summary) }}</p>
    </section>
    <section class="wrap border-t-4 border-ink pb-16 pt-10 lg:pb-28 lg:pt-14">
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <div class="mt-12 flex flex-wrap items-center justify-between gap-6 border-t-2 border-ink pt-8">
        <NuxtLink class="navlink border-ink text-[16px]" to="/clanky">{{ words.backToArticles }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-ink" :to="cta.url">{{ cta.label }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
  </article>
</template>
