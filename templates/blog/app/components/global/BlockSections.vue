<script setup lang="ts">
// Block "sections" (cms.config.ts): the sections with their latest articles, drawn by the site's look: components/<look>/Sections.vue.
defineProps<{ block: BlockOf<'sections'>; index?: number }>()
const articles = await useArticles()
const sections = await useSections()
</script>

<template>
  <LookPart part="Sections" :first="index === 0" :block="block" :articles="articles" :sections="sections" :anchor="anchorOf('sections')" />
</template>
