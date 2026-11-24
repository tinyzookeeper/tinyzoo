<script setup lang="ts">
// Block "gallery": photographs from all published albums in one mixed row, with the
// categories as a filter. Drawn by components/<look>/Gallery.vue.
const props = defineProps<{ block: BlockOf<'gallery'>; index?: number }>()
const albums = await useAlbums()
const skip = await useOpeningPhotoIds()
const tiles = computed(() => mixAlbumPhotos(albums.value, { limit: props.block.count ?? 14, skip: skip.value }))
</script>

<template>
  <LookPart part="Gallery" :first="index === 0" :block="block" :tiles="tiles" :album-count="albums.length" />
</template>
