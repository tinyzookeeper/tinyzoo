<script setup lang="ts">
// Block "news": the newest news as cards. Drawn by components/<look>/News.vue.
defineProps<{ block: BlockOf<'news'>; index?: number }>()
const news = await useNews()
</script>

<template>
  <LookPart part="News" :first="index === 0" :block="block" :news="news" :anchor="anchorOf('news')" />
</template>
