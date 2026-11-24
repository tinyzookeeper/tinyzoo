<script setup lang="ts">
// Block "opening" (cms.config.ts), drawn by the site's look: components/<look>/Opening.vue.
// The look works out today from the hours after the page is drawn (useClock).
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const hours = await useOpeningHours()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :hours="hours" />
</template>
