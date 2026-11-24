<script setup lang="ts">
// Block "fees": the table of prices by route and period; the period that holds today is lit.
// Drawn by components/<look>/Fees.vue.
defineProps<{ block: BlockOf<'fees'>; index?: number }>()
const fees = await useFees()
</script>

<template>
  <LookPart part="Fees" :first="index === 0" :block="block" :fees="fees" :anchor="anchorOf('fees')" />
</template>
