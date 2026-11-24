<script setup lang="ts">
// Block "services": what the firm builds, with what is and is not in the price. Drawn by
// components/<look>/Services.vue.
defineProps<{ block: BlockOf<'services'>; index?: number }>()
const items = await useServices()
</script>

<template>
  <LookPart part="Services" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('services')" />
</template>
