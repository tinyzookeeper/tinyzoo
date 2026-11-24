<script setup lang="ts">
// A series' page (/serial/rok-na-samote): the dark band with its latest part, and every part.
import type { Series } from '../../lib/cms-content'

const props = defineProps<{ entry: Series }>()
const { words } = await useBlog()
const articles = await useArticles()
const all = await useSeriesList()
const parts = computed(() => partsOf(articles.value, props.entry))
</script>

<template>
  <ObalkaSeries first :block="{ eyebrow: words.series, partsLabel: words.allParts }" :articles="articles" :series="all" :only="entry" />
  <section v-if="!parts.length" class="wrap py-16"><p class="font-display text-[1.2rem]">{{ words.noArticles }}</p></section>
</template>
