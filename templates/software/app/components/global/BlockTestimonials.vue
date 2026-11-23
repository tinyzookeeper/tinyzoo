<script setup lang="ts">
// Block "testimonials" (cms.config.ts), drawn by the site's look: components/<look>/Testimonials.vue. The testimonials come from their collection, in order.
defineProps<{ block: BlockOf<'testimonials'>; index?: number }>()
const items = await useTestimonials()
</script>

<template>
  <LookPart part="Testimonials" :first="index === 0" :block="block" :anchor="anchorOf('testimonials')" :items="items" />
</template>
