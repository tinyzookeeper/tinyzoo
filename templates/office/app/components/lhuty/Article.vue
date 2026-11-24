<script setup lang="ts">
// Lhůty's page of one article: the date in mono, the title in Plex Serif, the short text and the
// article between rules.
import type { Article } from '../../lib/cms-content'

defineProps<{ entry: Article }>()
const { words, cta } = await useOffice()
</script>

<template>
  <article>
    <section class="wrap pt-10 pb-10 lg:pt-14 lg:pb-12">
      <p class="label text-quiet"><span class="ticks" /><NuxtLink class="ulink" to="/clanky">{{ words.backToArticles }}</NuxtLink></p>
      <h1 class="mt-6 max-w-[26ch] font-display text-[34px] leading-[1.12] tracking-[-0.01em] sm:text-[44px] xl:text-[52px] xl:leading-[1.1]">{{ tidyText(entry.title) }}</h1>
      <p v-if="entry.date" class="num mt-6 text-[13px] text-signal-text"><time :datetime="dateParts(entry.date)?.iso">{{ numericDate(entry.date) }}</time></p>
      <p v-if="entry.summary" class="mt-5 max-w-[58ch] text-[18px] leading-[1.6] text-ink/85">{{ tidyText(entry.summary) }}</p>
    </section>
    <section class="wrap border-t border-ink pb-16 pt-10 lg:pb-24 lg:pt-12">
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <div class="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
        <NuxtLink class="ulink text-[16px]" to="/clanky">{{ words.backToArticles }}</NuxtLink>
        <NuxtLink v-if="cta" class="btn btn-brand" :to="cta.url">{{ cta.label }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
  </article>
</template>
