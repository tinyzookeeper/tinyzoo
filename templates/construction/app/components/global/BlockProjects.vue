<script setup lang="ts">
// Block "projects": the finished projects, one large and the others as cards, with a filter.
// Drawn by components/<look>/Projects.vue.
const props = defineProps<{ block: BlockOf<'projects'>; index?: number }>()
const projects = await useProjects()
const featured = computed(() => (props.block.showFeatured ? featuredOf(projects.value) : null))
const others = computed(() => othersOf(projects.value, props.block))
</script>

<template>
  <LookPart part="Projects" :first="index === 0" :block="block" :featured="featured" :others="others" :anchor="anchorOf('projects')" />
</template>
