<script setup lang="ts">
// Block "text" (cms.config.ts), drawn by the site's look: components/<look>/Text.vue.
defineProps<{ block: BlockOf<'text'>; index?: number }>()
</script>

<template>
  <LookPart part="Text" :first="index === 0" :block="block" />
</template>
