<script setup lang="ts">
// Block "makes": the makes, and what the garage does not do. Drawn by components/<look>/Makes.vue.
defineProps<{ block: BlockOf<'makes'>; index?: number }>()
</script>

<template>
  <LookPart part="Makes" :first="index === 0" :block="block" :anchor="anchorOf('makes')" />
</template>
