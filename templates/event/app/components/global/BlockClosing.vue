<script setup lang="ts">
// Block "closing": the last word before the footer. Needs the routes (the places left).
// Drawn by components/<look>/Closing.vue.
defineProps<{ block: BlockOf<'closing'>; index?: number }>()
const tracks = await useTracks()
</script>

<template>
  <LookPart part="Closing" :first="index === 0" :block="block" :tracks="tracks" />
</template>
