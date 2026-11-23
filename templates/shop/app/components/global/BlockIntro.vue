<script setup lang="ts">
// Block "intro": the opening. Drawn by components/<look>/Intro.vue, which writes today's hours
// and the "Open now" sign from Site settings (it reads them itself).
defineProps<{ block: BlockOf<'intro'>; index?: number }>()
</script>

<template>
  <LookPart part="Intro" :first="index === 0" :block="block" />
</template>
