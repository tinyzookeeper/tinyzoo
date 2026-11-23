<script setup lang="ts">
// Block "surroundings": what is nearby, from the Surroundings section. Drawn by components/<look>/Surroundings.vue.
defineProps<{ block: BlockOf<'surroundings'>; index?: number }>()
const places = await usePlaces()
</script>

<template>
  <LookPart part="Surroundings" :first="index === 0" :index="index" :block="block" :places="places" :anchor="anchorOf('surroundings')" />
</template>
