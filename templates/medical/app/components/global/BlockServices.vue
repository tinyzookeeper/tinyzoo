<script setup lang="ts">
// Block "services": the services insurance pays for. Drawn by components/<look>/Services.vue.
defineProps<{ block: BlockOf<'services'>; index?: number }>()
const all = await useServices()
const items = computed(() => coveredServices(all.value))
</script>

<template>
  <LookPart part="Services" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('services')" />
</template>
