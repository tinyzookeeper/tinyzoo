<script setup lang="ts">
// Block "articles": the newest articles, each with a page of its own. Drawn by components/<look>/Articles.vue.
const props = defineProps<{ block: BlockOf<'articles'>; index?: number }>()
const all = await useArticles()
const items = computed(() => (props.block.count ? all.value.slice(0, props.block.count) : all.value))
</script>

<template>
  <LookPart part="Articles" :first="index === 0" :block="block" :anchor="anchorOf('articles')" :items="items" />
</template>
