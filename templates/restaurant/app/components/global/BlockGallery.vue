<script setup lang="ts">
// Block "gallery": the photographs the site's look takes from the list (site.ts, GALLERY_PICKS).
// Drawn by components/<look>/Gallery.vue.
const props = defineProps<{ block: BlockOf<'gallery'>; index?: number }>()
const [look, { settings }] = await Promise.all([useLookId(), useSite()])
const photos = computed(() => galleryPhotos(props.block, look.value))
</script>

<template>
  <LookPart part="Gallery" :first="index === 0" :block="block" :photos="photos" :link="settings?.instagram ?? ''" :anchor="anchorOf('gallery')" />
</template>
