<script setup lang="ts">
// Block "gallery": photographs of the two. What the page already shows elsewhere in this look
// is left out, so no picture shows twice. Drawn by components/<look>/Gallery.vue.
const props = defineProps<{ block: BlockOf<'gallery'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [sections, look, { settings }] = await Promise.all([usePageSections(), useLookId(), useSite()])
const photos = computed(() => galleryPhotos(props.block, sections.value, look.value, settings.value))
</script>

<template>
  <LookPart part="Gallery" :first="index === 0" :block="block" :photos="photos" :anchor="anchorOf('gallery')" />
</template>
