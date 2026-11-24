<script setup lang="ts">
// Block "reviews": the first reviews of the Reviews section. Drawn by components/<look>/Reviews.vue.
const props = defineProps<{ block: BlockOf<'reviews'>; index?: number }>()
const all = await useReviews()
const items = computed(() => all.value.slice(0, props.block.count || 3))
</script>

<template>
  <LookPart part="Reviews" :first="index === 0" :block="block" :items="items" />
</template>
