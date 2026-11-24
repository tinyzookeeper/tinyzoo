<script setup lang="ts">
// Block "testimonials" (cms.config.ts): what clients said, drawn by the site's look: components/<look>/Testimonials.vue.
defineProps<{ block: BlockOf<'testimonials'>; index?: number }>()
const items = await useTestimonials()
</script>

<template>
  <LookPart part="Testimonials" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('testimonials')" />
</template>
