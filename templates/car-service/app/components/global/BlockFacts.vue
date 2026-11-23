<script setup lang="ts">
// Block "facts": four large figures. Drawn by components/<look>/Facts.vue.
defineProps<{ block: BlockOf<'facts'>; index?: number }>()
</script>

<template>
  <LookPart part="Facts" :first="index === 0" :block="block" />
</template>
