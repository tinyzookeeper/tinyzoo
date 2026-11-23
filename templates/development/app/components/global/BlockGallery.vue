<script setup lang="ts">
// Block "gallery": visualisations and photos from the site. Drawn by components/<look>/Gallery.vue.
defineProps<{ block: BlockOf<'gallery'>; index?: number }>()
</script>

<template>
  <LookPart part="Gallery" :first="index === 0" :index="index" :block="block" :anchor="anchorOf('gallery')" />
</template>
