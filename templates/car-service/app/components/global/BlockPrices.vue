<script setup lang="ts">
// Block "prices": the price list, the groups of Services and prices with their lines. Drawn by
// components/<look>/Prices.vue.
defineProps<{ block: BlockOf<'prices'>; index?: number }>()
// Both asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [groups, services] = await Promise.all([useServiceGroups(), useServices()])
const sets = computed(() => priceGroups(groups.value, services.value))
</script>

<template>
  <LookPart part="Prices" :first="index === 0" :block="block" :sets="sets" :anchor="anchorOf('prices')" />
</template>
