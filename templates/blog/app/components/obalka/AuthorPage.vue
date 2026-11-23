<script setup lang="ts">
// An author's page (/autor/tomas-havlena): the portrait and a few words about them, then their
// articles as the contents list.
import type { Author } from '~/lib/cms-content'

const props = defineProps<{ entry: Author }>()
const { words } = await useBlog()
const articles = await useArticles()
const items = computed(() => byAuthor(articles.value, props.entry))
</script>

<template>
  <section class="wrap grid gap-x-14 gap-y-8 pb-14 pt-12 lg:grid-cols-12 lg:pb-20 lg:pt-20">
    <div v-if="entry.photo" class="max-w-[22rem] lg:col-span-4"><div class="zoom"><CmsImage :media="entry.photo" eager sizes="22rem" class="aspect-[4/5] w-full object-cover" /></div></div>
    <div :class="entry.photo ? 'lg:col-span-8 lg:self-end' : 'lg:col-span-12'">
      <p class="kicker text-brand">{{ [entry.role, words.articlesOf(items.length)].filter(Boolean).join(' · ') }}</p>
      <h1 class="mt-3 font-display text-[3.4rem] font-extralight leading-[0.98] tracking-[-0.025em] lg:text-[5.6rem]">{{ entry.name }}</h1>
      <p v-if="entry.bio" class="mt-6 max-w-[36rem] font-display text-[1.25rem] leading-[1.55]">{{ tidyText(entry.bio) }}</p>
    </div>
  </section>
  <ObalkaList :block="{ heading: words.articlesByAuthor }" :items="items" />
</template>
