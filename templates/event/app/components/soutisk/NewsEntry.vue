<script setup lang="ts">
// A news item on a page of its own, in Soutisk: the date on a dark pill, the title in the
// display face, the text.
defineProps<{ entry: Record<string, any> }>()
const { words } = await useEvent()
</script>

<template>
  <article class="wrap pt-10 pb-16 sm:pb-24">
    <p class="inline-flex items-center h-9 px-4 rounded-full bg-ink text-paper font-bold text-sm"><time :datetime="String(entry.date).slice(0, 10)">{{ numericDate(entry.date) }}</time></p>
    <h1 class="h2 mt-5 max-w-[40rem]">{{ entry.title }}</h1>
    <p v-if="entry.summary" class="mt-5 text-lg sm:text-xl max-w-[36rem] text-quiet">{{ tidyText(entry.summary) }}</p>
    <CmsImage v-if="entry.image" :media="entry.image" eager sizes="(min-width: 1024px) 60rem, 100vw" class="mt-8 w-full max-h-[34rem] aspect-[3/2] object-cover rounded-[28px]" />
    <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look mt-8" />
    <p class="mt-10"><NuxtLink to="/aktuality" class="ulink"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToNews }}</NuxtLink></p>
  </article>
</template>
