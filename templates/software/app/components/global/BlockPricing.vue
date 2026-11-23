<script setup lang="ts">
// Block "pricing": the plans and the rows of the limits table, both from their collections.
// Drawn by components/<look>/Pricing.vue.
defineProps<{ block: BlockOf<'pricing'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [plans, limits] = await Promise.all([usePlans(), usePlanLimits()])
</script>

<template>
  <LookPart part="Pricing" :first="index === 0" :block="block" :plans="plans" :limits="limits" :anchor="anchorOf('pricing')" />
</template>
