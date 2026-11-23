<script setup lang="ts">
// Block "deadlines": the ruler of the nearest deadlines. Which are still ahead depends on
// today, so the look draws them after the page is mounted (see `useToday`).
defineProps<{ block: BlockOf<'deadlines'>; index?: number }>()
const items = await useDeadlines()
</script>

<template>
  <LookPart part="Deadlines" :first="index === 0" :block="block" :anchor="anchorOf('deadlines')" :items="items" />
</template>
