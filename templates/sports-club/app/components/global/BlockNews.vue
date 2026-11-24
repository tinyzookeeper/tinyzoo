<script setup lang="ts">
// Block "news": the newest articles, as many as the block says. Drawn by components/<look>/News.vue.
const props = defineProps<{ block: BlockOf<'news'>; index?: number }>()
const all = await useArticles()
const items = computed(() => all.value.slice(0, props.block.count ?? 4))
</script>

<template>
  <LookPart part="News" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('news')" />
</template>
