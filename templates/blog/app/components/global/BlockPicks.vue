<script setup lang="ts">
// Block "picks" (cms.config.ts): the editors' picks, drawn by the site's look: components/<look>/Picks.vue.
defineProps<{ block: BlockOf<'picks'>; index?: number }>()
const articles = await useArticles()
</script>

<template>
  <LookPart part="Picks" :first="index === 0" :block="block" :articles="articles" :anchor="anchorOf('picks')" />
</template>
