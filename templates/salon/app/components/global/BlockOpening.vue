<script setup lang="ts">
// Block "opening" (cms.config.ts), drawn by the site's look: components/<look>/Opening.vue.
// The services marked as quick prices come with it: one look draws them under the opening.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const services = await useServices()
const quick = computed(() => quickServices(services.value))
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :quick="quick" :anchor="anchorOf('opening')" />
</template>
