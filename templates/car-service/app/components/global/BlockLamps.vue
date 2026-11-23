<script setup lang="ts">
// Block "lamps": one warning light for every group of the price list, each leading to its group.
// Drawn by components/<look>/Lamps.vue.
defineProps<{ block: BlockOf<'lamps'>; index?: number }>()
const groups = await useServiceGroups()
</script>

<template>
  <LookPart part="Lamps" :first="index === 0" :block="block" :groups="groups" :anchor="anchorOf('lamps')" />
</template>
