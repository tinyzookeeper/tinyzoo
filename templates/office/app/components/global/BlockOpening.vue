<script setup lang="ts">
// Block "opening": the first screen. Šanony stands the services on a shelf beside the heading,
// so the block fetches them. Drawn by components/<look>/Opening.vue.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const services = await useServices()
const groups = await useServiceGroups()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :anchor="anchorOf('opening')" :groups="groups" :services="services" />
</template>
