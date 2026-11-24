<script setup lang="ts">
// Block "audience": the kinds of clients. Drawn by components/<look>/Audience.vue.
defineProps<{ block: BlockOf<'audience'>; index?: number }>()
</script>

<template>
  <LookPart part="Audience" :first="index === 0" :block="block" :anchor="anchorOf('audience')" />
</template>
