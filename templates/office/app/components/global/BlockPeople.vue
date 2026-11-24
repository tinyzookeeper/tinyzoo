<script setup lang="ts">
// Block "people": everybody of the People section. Drawn by components/<look>/People.vue.
defineProps<{ block: BlockOf<'people'>; index?: number }>()
const items = await usePeople()
</script>

<template>
  <LookPart part="People" :first="index === 0" :block="block" :anchor="anchorOf('people')" :items="items" />
</template>
