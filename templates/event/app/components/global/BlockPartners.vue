<script setup lang="ts">
// Block "partners": the partners and the organiser. Drawn by components/<look>/Partners.vue.
defineProps<{ block: BlockOf<'partners'>; index?: number }>()
const items = await usePartners()
</script>

<template>
  <LookPart part="Partners" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('partners')" />
</template>
