<script setup lang="ts">
// Block "developer": who builds, with the finished buildings. Drawn by components/<look>/Developer.vue.
defineProps<{ block: BlockOf<'developer'>; index?: number }>()
const references = await useReferences()
</script>

<template>
  <LookPart part="Developer" :first="index === 0" :index="index" :block="block" :references="references" :anchor="anchorOf('developer')" />
</template>
