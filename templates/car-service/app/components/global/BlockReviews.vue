<script setup lang="ts">
// Block "reviews": what customers said, the entries of Reviews. Drawn by components/<look>/Reviews.vue.
defineProps<{ block: BlockOf<'reviews'>; index?: number }>()
const items = await useReviews()
</script>

<template>
  <LookPart part="Reviews" :first="index === 0" :block="block" :items="items" />
</template>
