<script setup lang="ts">
// Block "pricelist": every service in its group. Drawn by components/<look>/PriceList.vue.
defineProps<{ block: BlockOf<'pricelist'>; index?: number }>()
const groups = await usePriceList()
</script>

<template>
  <LookPart part="PriceList" :first="index === 0" :block="block" :groups="groups" :anchor="anchorOf('pricelist')" />
</template>
