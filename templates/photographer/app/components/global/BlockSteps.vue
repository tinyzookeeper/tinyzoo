<script setup lang="ts">
// Block "steps" (cms.config.ts), drawn by the site's look: components/<look>/Steps.vue.
defineProps<{ block: BlockOf<'steps'>; index?: number }>()
</script>

<template>
  <LookPart part="Steps" :first="index === 0" :block="block" />
</template>
