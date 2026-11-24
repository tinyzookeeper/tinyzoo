<script setup lang="ts">
// Block "sold": the latest sales and how long each took. Drawn by components/<look>/Sold.vue.
defineProps<{ block: BlockOf<'sold'>; index?: number }>()
const sales = await useSales()
</script>

<template>
  <LookPart part="Sold" :first="index === 0" :block="block" :sales="sales" :anchor="anchorOf('sold')" />
</template>
