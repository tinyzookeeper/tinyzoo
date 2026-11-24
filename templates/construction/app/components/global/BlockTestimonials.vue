<script setup lang="ts">
// Block "testimonials": what people who live in the houses say. Drawn by components/<look>/Testimonials.vue.
defineProps<{ block: BlockOf<'testimonials'>; index?: number }>()
const items = await useTestimonials()
</script>

<template>
  <LookPart part="Testimonials" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('testimonials')" />
</template>
