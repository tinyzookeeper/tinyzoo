<script setup lang="ts">
// Block "practical": cards of practical information and the rules in brief. Drawn by components/<look>/Practical.vue.
defineProps<{ block: BlockOf<'practical'>; index?: number }>()
</script>

<template>
  <LookPart part="Practical" :first="index === 0" :block="block" :anchor="anchorOf('practical')" />
</template>
