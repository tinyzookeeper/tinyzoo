<script setup lang="ts">
// Block "results": photographs of finished work. Drawn by components/<look>/Results.vue.
defineProps<{ block: BlockOf<'results'>; index?: number }>()
const items = await useResults()
</script>

<template>
  <LookPart part="Results" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('results')" />
</template>
