<script setup lang="ts">
// Block "where": the week's hours, the address, the way there and a sketch of the street.
// Drawn by components/<look>/Where.vue, which reads the hours and the address from Site settings.
defineProps<{ block: BlockOf<'where'>; index?: number }>()
</script>

<template>
  <LookPart part="Where" :first="index === 0" :block="block" :anchor="anchorOf('where')" />
</template>
