<script setup lang="ts">
// Block "story": how the two met, in parts with photographs. Drawn by components/<look>/Story.vue.
defineProps<{ block: BlockOf<'story'>; index?: number }>()
</script>

<template>
  <LookPart part="Story" :first="index === 0" :block="block" :anchor="anchorOf('story')" />
</template>
