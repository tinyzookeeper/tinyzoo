<script setup lang="ts">
// Block "opening" (cms.config.ts): the project's name, a photo and four key facts that are read
// from the flats. Drawn by the site's look: components/<look>/Opening.vue.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const flats = await useFlats()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :flats="flats" :anchor="anchorOf('opening')" />
</template>
