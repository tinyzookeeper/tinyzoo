<script setup lang="ts">
// Hřiště's article page: a pill with the section and the date, a headline that leans forward, the
// first words in grey, a soft-cornered photograph and the text in a column.
import type { Article } from '~/lib/cms-content'

const props = defineProps<{ entry: Article }>()
const words = useSiteWords()
</script>

<template>
  <article>
    <section class="wrap pt-6 lg:pt-10">
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14.5px] text-quiet"><span class="rounded-full bg-brand-soft px-3 py-1 font-display font-extrabold text-brand">{{ words.categoryLong[entry.category] }}</span>{{ entry.date ? numericDate(entry.date) : '' }}</p>
      <h1 class="disp mt-4 max-w-[22ch] text-[clamp(32px,4.6vw,60px)] !leading-[1.04]">{{ tidyText(entry.title) }}</h1>
      <p v-if="entry.summary" class="mt-5 max-w-[38rem] text-[19px] text-quiet">{{ tidyText(entry.summary) }}</p>
      <div v-if="entry.image" class="photo mt-8 lg:mt-10"><CmsImage :media="entry.image" eager sizes="(min-width: 1304px) 1304px, 100vw" class="aspect-[3/2] w-full object-cover lg:aspect-[2.4/1]" /></div>
    </section>
    <section class="wrap py-10 lg:py-14">
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <p class="mt-10"><NuxtLink class="more" to="/aktuality"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.allArticles }}</NuxtLink></p>
    </section>
  </article>
</template>
