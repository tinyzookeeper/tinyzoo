<script setup lang="ts">
// Zpravodaj's article page: the section and date in small capitals, the headline, the first words
// large, the framed photograph and the text in a column.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ entry: Article }>()
const words = useSiteWords()
const stamp = computed(() => [words.value.category[props.entry.category], dateParts(props.entry.date)?.date].filter(Boolean).join(' · '))
</script>

<template>
  <article>
    <section class="wrap pt-10 lg:pt-16">
      <p class="label">{{ stamp }}</p>
      <h1 class="mt-5 max-w-[24ch] text-[clamp(32px,4.8vw,60px)] font-extrabold leading-[1.05] tracking-[-.02em]">{{ tidyText(entry.title) }}</h1>
      <p v-if="entry.summary" class="mt-6 max-w-[38rem] text-lg leading-relaxed">{{ tidyText(entry.summary) }}</p>
      <figure v-if="entry.image" class="mt-10 max-w-[56rem]"><div class="frame"><CmsImage :media="entry.image" eager sizes="(min-width: 1024px) 56rem, 100vw" class="aspect-[3/2] w-full object-cover" /></div></figure>
    </section>
    <section class="wrap py-10 lg:py-14">
      <div class="max-w-[44rem]"><CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" /></div>
      <p class="mt-12 border-t border-ink pt-6"><NuxtLink class="link" to="/aktuality">{{ words.allArticles }}</NuxtLink></p>
    </section>
  </article>
</template>
