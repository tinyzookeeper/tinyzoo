<script setup lang="ts">
// Block "process": how a build goes, before, during and after. Drawn by components/<look>/Process.vue.
defineProps<{ block: BlockOf<'process'>; index?: number }>()
</script>

<template>
  <LookPart part="Process" :first="index === 0" :block="block" :anchor="anchorOf('process')" />
</template>
