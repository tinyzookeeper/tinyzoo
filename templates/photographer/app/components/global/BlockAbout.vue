<script setup lang="ts">
// Block "about" (cms.config.ts), drawn by the site's look: components/<look>/About.vue.
defineProps<{ block: BlockOf<'about'>; index?: number }>()
</script>

<template>
  <LookPart part="About" :first="index === 0" :block="block" />
</template>
