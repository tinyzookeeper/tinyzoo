<script setup lang="ts">
// Block "prices": the price list, from the Services section. Drawn by components/<look>/Prices.vue.
defineProps<{ block: BlockOf<'prices'>; index?: number }>()
const items = await useServices()
</script>

<template>
  <LookPart part="Prices" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('prices')" />
</template>
