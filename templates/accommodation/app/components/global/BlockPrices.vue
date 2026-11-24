<script setup lang="ts">
// Block "prices": the rooms against the seasons, what is included and the extra charges.
// Drawn by components/<look>/Prices.vue.
defineProps<{ block: BlockOf<'prices'>; index?: number }>()
const pricing = await usePricing()
const rooms = computed(() => roomRows(pricing))
</script>

<template>
  <LookPart part="Prices" :first="index === 0" :block="block" :rooms="rooms" :seasons="pricing.seasons.value" :anchor="anchorOf('prices')" />
</template>
