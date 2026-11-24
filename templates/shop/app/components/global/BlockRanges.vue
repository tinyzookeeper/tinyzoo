<script setup lang="ts">
// Block "ranges": the departments of the shop. Drawn by components/<look>/Ranges.vue.
defineProps<{ block: BlockOf<'ranges'>; index?: number }>()
const items = await useRanges()
</script>

<template>
  <LookPart part="Ranges" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('ranges')" />
</template>
