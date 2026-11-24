<script setup lang="ts">
// Block "progress": where the construction stands, with its stages. Drawn by components/<look>/Progress.vue.
defineProps<{ block: BlockOf<'progress'>; index?: number }>()
const milestones = await useMilestones()
</script>

<template>
  <LookPart part="Progress" :first="index === 0" :index="index" :block="block" :milestones="milestones" :anchor="anchorOf('progress')" />
</template>
