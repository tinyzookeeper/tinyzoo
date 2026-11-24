<script setup lang="ts">
// Block "sellers": what the agency does for a seller, and the form that asks for a price
// estimate (the Valuation form). Drawn by components/<look>/Sellers.vue.
defineProps<{ block: BlockOf<'sellers'>; index?: number }>()
const form = await useSiteForm('valuation', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Sellers" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('sellers')" :form-anchor="anchorOf('valuation')" />
</template>
