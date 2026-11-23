<script setup lang="ts">
// Block "gallery": photographs of the last edition. Drawn by components/<look>/Gallery.vue.
defineProps<{ block: BlockOf<'gallery'>; index?: number }>()
</script>

<template>
  <LookPart part="Gallery" :first="index === 0" :block="block" :anchor="anchorOf('gallery')" />
</template>
