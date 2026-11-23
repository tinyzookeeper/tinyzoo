<script setup lang="ts">
// Block "people": the shop's story and the people behind the counter. Drawn by
// components/<look>/People.vue.
defineProps<{ block: BlockOf<'people'>; index?: number }>()
const items = await usePeople()
</script>

<template>
  <LookPart part="People" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('people')" />
</template>
