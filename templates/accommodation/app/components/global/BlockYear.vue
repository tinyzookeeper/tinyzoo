<script setup lang="ts">
// Block "year": the seasons of the year with the price from, in the editors' order. Drawn by
// components/<look>/Year.vue.
defineProps<{ block: BlockOf<'year'>; index?: number }>()
const pricing = await usePricing()
const rows = computed(() => pricing.seasons.value.map((season) => ({ season, from: pricing.seasonFrom(season.id) })))
</script>

<template>
  <LookPart part="Year" :first="index === 0" :block="block" :rows="rows" :anchor="anchorOf('year')" />
</template>
