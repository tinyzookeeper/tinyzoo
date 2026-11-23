<script setup lang="ts">
// Block "brands" (cms.config.ts), drawn by the site's look: components/<look>/Brands.vue.
defineProps<{ block: BlockOf<'brands'>; index?: number }>()
</script>

<template>
  <LookPart part="Brands" :first="index === 0" :block="block" :anchor="anchorOf('brands')" />
</template>
