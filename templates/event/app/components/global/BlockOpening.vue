<script setup lang="ts">
// Block "opening" (cms.config.ts): the name, the day, the countdown, the registration button.
// Needs the routes (places left) and the fees (the price now). Drawn by components/<look>/Opening.vue.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
const fees = await useFees()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :fees="fees" />
</template>
