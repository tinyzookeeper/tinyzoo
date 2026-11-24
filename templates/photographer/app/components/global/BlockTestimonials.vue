<script setup lang="ts">
// Block "testimonials": what clients said (the Testimonials collection), the first ones in the
// editors' order. Drawn by components/<look>/Testimonials.vue.
const props = defineProps<{ block: BlockOf<'testimonials'>; index?: number }>()
const all = await useTestimonials()
const items = computed(() => all.value.slice(0, props.block.count ?? 3))
</script>

<template>
  <LookPart v-if="items.length" part="Testimonials" :first="index === 0" :block="block" :items="items" />
</template>
