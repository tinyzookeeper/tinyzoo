<script setup lang="ts">
// An author's page (/autor/tomas-havlena): the round portrait and a few words about them, then
// their articles as the staircase.
import type { Author } from '~/lib/cms-content'

const props = defineProps<{ entry: Author }>()
const { words } = await useBlog()
const articles = await useArticles()
const items = computed(() => byAuthor(articles.value, props.entry))
const sorted = computed(() => [...items.value].sort((a, b) => minutesOf(a) - minutesOf(b)))
</script>

<template>
  <section class="wrap grid items-center gap-x-12 gap-y-8 pb-14 pt-6 lg:grid-cols-12 lg:pb-20 lg:pt-10">
    <div v-if="entry.photo" class="max-w-[16rem] lg:col-span-3"><CmsImage :media="entry.photo" eager sizes="16rem" class="aspect-square w-full rounded-full object-cover object-[50%_22%]" /></div>
    <div :class="entry.photo ? 'lg:col-span-9' : 'lg:col-span-12'">
      <p class="meta">{{ [entry.role, words.articlesOf(items.length)].filter(Boolean).join(' · ') }}</p>
      <h1 class="mt-3 text-[3.3rem] font-black leading-[0.94] tracking-[-0.045em] lg:text-[5.4rem]">{{ entry.name }}</h1>
      <p v-if="entry.bio" class="stand mt-5 max-w-[36rem] text-[1.35rem] lg:text-[1.5rem]">{{ tidyText(entry.bio) }}</p>
    </div>
  </section>
  <CtvrthodinkaList :block="{ heading: words.articlesByAuthor }" :items="sorted" />
</template>
