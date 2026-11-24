<script setup lang="ts">
// Block "prices": the services the patient pays for, with prices. Drawn by components/<look>/Prices.vue.
defineProps<{ block: BlockOf<'prices'>; index?: number }>()
const all = await useServices()
const items = computed(() => paidServices(all.value))
</script>

<template>
  <LookPart part="Prices" :first="index === 0" :block="block" :items="items" />
</template>
