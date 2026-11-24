<script setup lang="ts">
// Block "questions": the questions and answers. Drawn by components/<look>/Questions.vue.
defineProps<{ block: BlockOf<'questions'>; index?: number }>()
const items = await useQuestions()
</script>

<template>
  <LookPart part="Questions" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('questions')" />
</template>
