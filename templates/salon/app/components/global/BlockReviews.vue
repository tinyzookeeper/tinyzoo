<script setup lang="ts">
// Block "reviews": what customers said. Drawn by components/<look>/Reviews.vue.
defineProps<{ block: BlockOf<'reviews'>; index?: number }>()
const items = await useReviews()
</script>

<template>
  <LookPart part="Reviews" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('reviews')" />
</template>
