<script setup lang="ts">
// Block "questions" (cms.config.ts), drawn by the site's look: components/<look>/Questions.vue. The questions come from their collection, in order.
defineProps<{ block: BlockOf<'questions'>; index?: number }>()
const items = await useQuestions()
</script>

<template>
  <LookPart part="Questions" :first="index === 0" :block="block" :anchor="anchorOf('questions')" :items="items" />
</template>
