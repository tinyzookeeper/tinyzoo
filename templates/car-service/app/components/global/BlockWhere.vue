<script setup lang="ts">
// Block "where": how to get there, the address and the hours of Site settings. Drawn by
// components/<look>/Where.vue.
defineProps<{ block: BlockOf<'where'>; index?: number }>()
</script>

<template>
  <LookPart part="Where" :first="index === 0" :block="block" :anchor="anchorOf('where')" />
</template>
