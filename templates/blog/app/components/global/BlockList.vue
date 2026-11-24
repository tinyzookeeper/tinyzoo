<script setup lang="ts">
// Block "list" (cms.config.ts): the denser list of articles, drawn by the site's look:
// components/<look>/List.vue. Each look takes its own articles from it (listOf in app/utils/site.ts).
const props = defineProps<{ block: BlockOf<'list'>; index?: number }>()
const articles = await useArticles()
const look = await useLookId()
const items = computed(() => listOf(articles.value, props.block, look.value))
</script>

<template>
  <LookPart part="List" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('list')" />
</template>
