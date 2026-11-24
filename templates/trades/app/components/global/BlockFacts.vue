<script setup lang="ts">
// Block "facts" (cms.config.ts), drawn by the site's look: components/<look>/Facts.vue.
defineProps<{ block: BlockOf<'facts'>; index?: number }>()
</script>

<template>
  <LookPart part="Facts" :first="index === 0" :block="block" />
</template>
