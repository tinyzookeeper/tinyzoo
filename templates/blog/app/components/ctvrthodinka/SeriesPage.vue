<script setup lang="ts">
// A series' page (/serial/rok-na-samote): the year as a clock with its latest part, and every part.
import type { Series } from '~/lib/cms-content'

const props = defineProps<{ entry: Series }>()
const { words } = await useBlog()
const articles = await useArticles()
const all = await useSeriesList()
const parts = computed(() => partsOf(articles.value, props.entry))
</script>

<template>
  <CtvrthodinkaSeries first :block="{ eyebrow: words.series, partsLabel: words.allParts }" :articles="articles" :series="all" :only="entry" />
  <section v-if="!parts.length" class="wrap py-16"><p class="text-[1.2rem] font-medium">{{ words.noArticles }}</p></section>
</template>
