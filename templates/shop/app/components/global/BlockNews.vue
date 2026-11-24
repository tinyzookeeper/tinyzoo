<script setup lang="ts">
// Block "news": the latest news (all of it when the block's count is 0). Drawn by
// components/<look>/News.vue.
const props = defineProps<{ block: BlockOf<'news'>; index?: number }>()
const all = await useNews()
const items = computed(() => (props.block.count ? all.value.slice(0, props.block.count) : all.value))
</script>

<template>
  <LookPart part="News" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('news')" />
</template>
