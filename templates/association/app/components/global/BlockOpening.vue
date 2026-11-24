<script setup lang="ts">
// Block "opening" (cms.config.ts): the heading and the photograph, and under the photograph the
// nearest event. Drawn by components/<look>/Opening.vue.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const events = await useEvents()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :events="events" />
</template>
