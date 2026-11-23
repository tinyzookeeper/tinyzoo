<script setup lang="ts">
// Block "hero" (cms.config.ts), drawn by the site's look: components/<look>/Hero.vue.
defineProps<{ block: BlockOf<'hero'>; index?: number }>()
</script>

<template>
  <LookPart part="Hero" :first="index === 0" :block="block" />
</template>
