<script setup lang="ts">
// Block "hours": the opening hours of Site settings, the house, the plan and the way there.
// Drawn by components/<look>/Hours.vue.
defineProps<{ block: BlockOf<'hours'>; index?: number }>()
</script>

<template>
  <LookPart part="Hours" :first="index === 0" :block="block" :anchor="anchorOf('hours')" />
</template>
