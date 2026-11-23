<script setup lang="ts">
// Block "steps": how a repair goes. Drawn by components/<look>/Steps.vue.
defineProps<{ block: BlockOf<'steps'>; index?: number }>()
</script>

<template>
  <LookPart part="Steps" :first="index === 0" :block="block" :anchor="anchorOf('steps')" />
</template>
