<script setup lang="ts">
// Block "trips": the tips for trips, filtered by season in the browser. Drawn by
// components/<look>/Trips.vue.
defineProps<{ block: BlockOf<'trips'>; index?: number }>()
const trips = await useTrips()
</script>

<template>
  <LookPart part="Trips" :first="index === 0" :block="block" :trips="trips" :anchor="anchorOf('trips')" />
</template>
