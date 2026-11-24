<script setup lang="ts">
// Block "services": the price list, the services in their groups. Drawn by components/<look>/Services.vue.
defineProps<{ block: BlockOf<'services'>; index?: number }>()
const groups = await useServiceGroups()
const services = await useServices()
</script>

<template>
  <LookPart part="Services" :first="index === 0" :block="block" :anchor="anchorOf('services')" :groups="groups" :services="services" />
</template>
