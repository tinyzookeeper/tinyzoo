<script setup lang="ts">
// Block "projects" (cms.config.ts): the projects selected for the home page, or all of them
// (the page of all projects). Drawn by the site's look: components/<look>/Projects.vue.
const props = defineProps<{ block: BlockOf<'projects'>; index?: number }>()
const all = await useProjects()
const items = computed(() => (props.block.show === 'all' ? all.value : all.value.filter((p) => p.featured)))
</script>

<template>
  <LookPart part="Projects" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('projects')" />
</template>
