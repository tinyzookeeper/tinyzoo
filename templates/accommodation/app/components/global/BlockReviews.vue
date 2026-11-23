<script setup lang="ts">
// Block "reviews": what guests wrote. Drawn by components/<look>/Reviews.vue.
defineProps<{ block: BlockOf<'reviews'>; index?: number }>()
const reviews = await useReviews()
</script>

<template>
  <LookPart part="Reviews" :first="index === 0" :block="block" :reviews="reviews" :anchor="anchorOf('reviews')" />
</template>
