<script setup lang="ts">
// Block "space": the rooms, with photographs and facts. Drawn by components/<look>/Space.vue.
defineProps<{ block: BlockOf<'space'>; index?: number }>()
</script>

<template>
  <LookPart part="Space" :first="index === 0" :block="block" :anchor="anchorOf('space')" />
</template>
