<script setup lang="ts">
// Block "kitchen": who cooks, and the suppliers. Drawn by components/<look>/Kitchen.vue.
defineProps<{ block: BlockOf<'kitchen'>; index?: number }>()
const suppliers = await useSuppliers()
</script>

<template>
  <LookPart part="Kitchen" :first="index === 0" :block="block" :suppliers="suppliers" :anchor="anchorOf('kitchen')" />
</template>
