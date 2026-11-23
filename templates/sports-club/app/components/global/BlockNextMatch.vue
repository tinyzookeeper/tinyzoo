<script setup lang="ts">
// Block "nextMatch" (cms.config.ts): the opening, the next match of the main team. Which match is
// next depends on today, so it is worked out after the page is mounted. Drawn by components/<look>/NextMatch.vue.
defineProps<{ block: BlockOf<'nextMatch'>; index?: number }>()
const now = useNow()
const next = await useNextMatch(now)
</script>

<template>
  <LookPart part="NextMatch" :first="index === 0" :block="block" :next="next" />
</template>
