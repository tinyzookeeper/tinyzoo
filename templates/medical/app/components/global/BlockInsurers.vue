<script setup lang="ts">
// Block "insurers": the health insurers the practice has a contract with. Drawn by components/<look>/Insurers.vue.
defineProps<{ block: BlockOf<'insurers'>; index?: number }>()
const items = await useInsurers()
</script>

<template>
  <LookPart part="Insurers" :first="index === 0" :block="block" :items="items" />
</template>
