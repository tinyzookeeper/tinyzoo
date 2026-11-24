<script setup lang="ts">
// Block "people": the committee. Drawn by components/<look>/People.vue.
defineProps<{ block: BlockOf<'people'>; index?: number }>()
const people = await usePeople()
</script>

<template>
  <LookPart part="People" :first="index === 0" :block="block" :people="people" :anchor="anchorOf('people')" />
</template>
