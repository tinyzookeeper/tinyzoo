<script setup lang="ts">
// A news item on a page of its own, in Časomíra: the date lit, the title in heavy type, the text.
const props = defineProps<{ entry: Record<string, any> }>()
const { words } = await useEvent()
</script>

<template>
  <article class="wrap pt-36 sm:pt-44 pb-16 sm:pb-24">
    <p class="font-mono text-led"><time :datetime="String(entry.date).slice(0, 10)">{{ numericDate(entry.date, true) }}</time></p>
    <h1 class="h2 mt-4 max-w-[40rem]">{{ entry.title }}</h1>
    <p v-if="entry.summary" class="mt-5 text-lg sm:text-xl max-w-[36rem] text-text/90">{{ tidyText(entry.summary) }}</p>
    <CmsImage v-if="entry.image" :media="entry.image" eager sizes="(min-width: 1024px) 60rem, 100vw" class="ph mt-8 w-full max-h-[34rem] aspect-[3/2] object-cover rounded-[6px]" />
    <CmsContent v-if="entry.body" :doc="entry.body" class="prose-look mt-8" />
    <p class="mt-10"><NuxtLink to="/aktuality" class="ulink mono"><UIcon name="i-lucide-arrow-left" aria-hidden="true" /> {{ words.backToNews }}</NuxtLink></p>
  </article>
</template>
