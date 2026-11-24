<script setup lang="ts">
// Block "albums": every published album, with the categories to choose from (each category
// has a page of its own: /galerie/<category>). Drawn by components/<look>/Albums.vue.
defineProps<{ block: BlockOf<'albums'>; index?: number }>()
const albums = await useAlbums()
const categories = await useCategories()
</script>

<template>
  <LookPart part="Albums" :first="index === 0" :eyebrow="block.eyebrow" :heading="block.heading" :text="block.text" :albums="albums" :categories="categories" :active="null" />
</template>
