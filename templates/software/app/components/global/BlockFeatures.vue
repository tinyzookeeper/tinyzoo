<script setup lang="ts">
// Block "features" (cms.config.ts), drawn by the site's look: components/<look>/Features.vue. The features come from the Features collection, in order.
defineProps<{ block: BlockOf<'features'>; index?: number }>()
const items = await useFeatures()
</script>

<template>
  <LookPart part="Features" :first="index === 0" :block="block" :anchor="anchorOf('features')" :items="items" />
</template>
