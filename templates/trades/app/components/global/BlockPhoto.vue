<script setup lang="ts">
// Block "photo" (cms.config.ts), drawn by the site's look: components/<look>/Photo.vue.
defineProps<{ block: BlockOf<'photo'>; index?: number }>()
</script>

<template>
  <LookPart part="Photo" :first="index === 0" :block="block" />
</template>
