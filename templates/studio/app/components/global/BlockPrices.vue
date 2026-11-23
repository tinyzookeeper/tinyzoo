<script setup lang="ts">
// Block "prices": the price list. Drawn by components/<look>/Prices.vue.
defineProps<{ block: BlockOf<'prices'>; index?: number }>()
const tariffs = await useTariffs()
</script>

<template>
  <LookPart part="Prices" :first="index === 0" :block="block" :tariffs="tariffs" :anchor="anchorOf('prices')" />
</template>
