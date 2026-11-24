<script setup lang="ts">
// Block "series" (cms.config.ts): a series and its parts, drawn by the site's look: components/<look>/Series.vue.
defineProps<{ block: BlockOf<'series'>; index?: number }>()
const articles = await useArticles()
const series = await useSeriesList()
</script>

<template>
  <LookPart part="Series" :first="index === 0" :block="block" :articles="articles" :series="series" :anchor="anchorOf('series')" />
</template>
