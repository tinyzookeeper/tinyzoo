<script setup lang="ts">
// Block "opening" (cms.config.ts): the first screen with the search over the listings. Drawn by
// the site's look: components/<look>/Opening.vue.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const { listings, total, fresh, featured } = await useOffer()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :listings="listings" :total="total" :fresh="fresh" :featured="featured" :anchor="anchorOf('listings')" />
</template>
