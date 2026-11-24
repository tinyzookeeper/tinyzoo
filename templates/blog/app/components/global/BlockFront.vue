<script setup lang="ts">
// Block "front" (cms.config.ts): the lead article and the short articles, drawn by the site's look: components/<look>/Front.vue.
defineProps<{ block: BlockOf<'front'>; index?: number }>()
const articles = await useArticles()
</script>

<template>
  <LookPart part="Front" :first="index === 0" :block="block" :articles="articles" />
</template>
