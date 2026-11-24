<script setup lang="ts">
// Block "venue": the address, the numbered points and the plan. Drawn by components/<look>/Venue.vue.
defineProps<{ block: BlockOf<'venue'>; index?: number }>()
const points = await useVenuePoints()
</script>

<template>
  <LookPart part="Venue" :first="index === 0" :block="block" :points="points" :anchor="anchorOf('venue')" />
</template>
