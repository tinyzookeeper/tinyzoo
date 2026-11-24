<script setup lang="ts">
// Block "place": the address from Site settings, photographs and how to get there.
// Drawn by components/<look>/Place.vue.
defineProps<{ block: BlockOf<'place'>; index?: number }>()
</script>

<template>
  <LookPart part="Place" :first="index === 0" :block="block" :anchor="anchorOf('place')" />
</template>
