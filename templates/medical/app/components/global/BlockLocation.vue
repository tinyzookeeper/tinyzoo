<script setup lang="ts">
// Block "location": the house, the address and the way there. Drawn by components/<look>/Location.vue.
defineProps<{ block: BlockOf<'location'>; index?: number }>()
</script>

<template>
  <LookPart part="Location" :first="index === 0" :block="block" :anchor="anchorOf('location')" />
</template>
