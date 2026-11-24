<script setup lang="ts">
// Block "services" (cms.config.ts): the services of the price list, drawn by the site's look: components/<look>/Services.vue.
defineProps<{ block: BlockOf<'services'>; index?: number }>()
const items = await useServices()
</script>

<template>
  <LookPart part="Services" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('services')" />
</template>
