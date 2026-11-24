<script setup lang="ts">
// Block "authors" (cms.config.ts): the authors, drawn by the site's look: components/<look>/Authors.vue.
defineProps<{ block: BlockOf<'authors'>; index?: number }>()
const articles = await useArticles()
const authors = await useAuthors()
</script>

<template>
  <LookPart part="Authors" :first="index === 0" :block="block" :articles="articles" :authors="authors" :anchor="anchorOf('authors')" />
</template>
