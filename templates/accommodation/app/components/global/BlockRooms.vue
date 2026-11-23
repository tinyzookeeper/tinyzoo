<script setup lang="ts">
// Block "rooms": the rooms and apartments with their cheapest night and the price in each
// season; each leads to its own page. Drawn by components/<look>/Rooms.vue.
defineProps<{ block: BlockOf<'rooms'>; index?: number }>()
const pricing = await usePricing()
const rooms = computed(() => roomRows(pricing))
</script>

<template>
  <LookPart part="Rooms" :first="index === 0" :block="block" :rooms="rooms" :seasons="pricing.seasons.value" :anchor="anchorOf('rooms')" />
</template>
