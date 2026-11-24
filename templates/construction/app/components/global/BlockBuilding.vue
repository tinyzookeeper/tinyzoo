<script setup lang="ts">
// Block "building": the projects under construction. Drawn by components/<look>/Building.vue.
defineProps<{ block: BlockOf<'building'>; index?: number }>()
const projects = await useProjects()
const items = computed(() => underway(projects.value))
</script>

<template>
  <LookPart part="Building" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('building')" />
</template>
