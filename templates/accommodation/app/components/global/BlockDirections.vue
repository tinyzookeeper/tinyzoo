<script setup lang="ts">
// Block "directions": the address with the way here. Drawn by components/<look>/Directions.vue.
defineProps<{ block: BlockOf<'directions'>; index?: number }>()
</script>

<template>
  <LookPart part="Directions" :first="index === 0" :block="block" :anchor="anchorOf('directions')" />
</template>
