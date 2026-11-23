<script setup lang="ts">
// Block "detail": the property marked for the opening, in detail. Drawn by components/<look>/Detail.vue.
defineProps<{ block: BlockOf<'detail'>; index?: number }>()
const { featured } = await useOffer()
</script>

<template>
  <LookPart part="Detail" :first="index === 0" :block="block" :listing="featured" :anchor="anchorOf('detail')" />
</template>
