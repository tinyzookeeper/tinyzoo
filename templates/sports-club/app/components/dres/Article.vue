<script setup lang="ts">
// Dres's article page: the section and date in small capitals over a headline in heavy wide
// letters, the photograph across the whole width and the text in a column.
import type { Article } from '../../lib/cms-content'

const props = defineProps<{ entry: Article }>()
const words = useSiteWords()
const stamp = computed(() => [words.value.category[props.entry.category], props.entry.date ? numericDate(props.entry.date, 'slash') : ''].filter(Boolean).join(' · '))
</script>

<template>
  <article>
    <section class="wrap pt-12 lg:pt-16">
      <p class="cap">{{ stamp }}</p>
      <h1 class="head mt-4 max-w-[22ch] text-[clamp(30px,5.4vw,72px)] !leading-[1.02]">{{ tidyText(entry.title) }}</h1>
      <p v-if="entry.summary" class="mt-5 max-w-[40rem] text-[19px] font-medium leading-snug lg:text-[22px]">{{ tidyText(entry.summary) }}</p>
    </section>
    <CmsImage v-if="entry.image" :media="entry.image" eager sizes="100vw" class="mt-8 aspect-[4/3] w-full object-cover md:aspect-[21/9]" />
    <section class="wrap py-10 lg:py-14">
      <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look" />
      <p class="mt-12 border-t-4 border-ink pt-6"><NuxtLink class="font-bold underline decoration-2 underline-offset-4 hover:bg-ink hover:text-paper" to="/aktuality">{{ words.allArticles }}</NuxtLink></p>
    </section>
  </article>
</template>
