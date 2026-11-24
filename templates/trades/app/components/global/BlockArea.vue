<script setup lang="ts">
// Block "area": the towns the business covers, from the Towns section. Drawn by components/<look>/Area.vue.
defineProps<{ block: BlockOf<'area'>; index?: number }>()
const items = await useTowns()
</script>

<template>
  <LookPart part="Area" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('area')" />
</template>
