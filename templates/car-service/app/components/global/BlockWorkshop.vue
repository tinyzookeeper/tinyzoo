<script setup lang="ts">
// Block "workshop": large photographs with captions. Drawn by components/<look>/Workshop.vue.
defineProps<{ block: BlockOf<'workshop'>; index?: number }>()
</script>

<template>
  <LookPart part="Workshop" :first="index === 0" :block="block" />
</template>
