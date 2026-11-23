<script setup lang="ts">
// Block "financing": the payments, worked out for an example flat. Drawn by components/<look>/Financing.vue.
defineProps<{ block: BlockOf<'financing'>; index?: number }>()
const flats = await useFlats()
</script>

<template>
  <LookPart part="Financing" :first="index === 0" :index="index" :block="block" :flats="flats" :anchor="anchorOf('financing')" />
</template>
