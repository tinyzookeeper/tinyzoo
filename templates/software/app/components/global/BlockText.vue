<script setup lang="ts">
// Block "text": paragraphs, headings, lists and links. Drawn by components/<look>/Text.vue.
defineProps<{ block: BlockOf<'text'>; index?: number }>()
</script>

<template>
  <LookPart part="Text" :first="index === 0" :block="block" />
</template>
