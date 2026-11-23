<script setup lang="ts">
// Block "story" (cms.config.ts), drawn by the site's look: components/<look>/Story.vue.
defineProps<{ block: BlockOf<'story'>; index?: number }>()
</script>

<template>
  <LookPart part="Story" :first="index === 0" :block="block" />
</template>
