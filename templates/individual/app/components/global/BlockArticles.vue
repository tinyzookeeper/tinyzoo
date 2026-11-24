<script setup lang="ts">
// Block "articles" (cms.config.ts): the newest articles, as many as the block says (none: all).
// Drawn by the site's look: components/<look>/Articles.vue.
const props = defineProps<{ block: BlockOf<'articles'>; index?: number }>()
const all = await useArticles()
const items = computed(() => (props.block.count ? all.value.slice(0, props.block.count) : all.value))
</script>

<template>
  <LookPart part="Articles" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('articles')" />
</template>
