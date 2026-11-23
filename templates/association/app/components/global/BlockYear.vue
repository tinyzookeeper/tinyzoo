<script setup lang="ts">
// Block "year": the strip of twelve months (Site settings) and the projects. Drawn by components/<look>/Year.vue.
defineProps<{ block: BlockOf<'year'>; index?: number }>()
const projects = await useProjects()
</script>

<template>
  <LookPart part="Year" :first="index === 0" :block="block" :projects="projects" :anchor="anchorOf('year')" />
</template>
