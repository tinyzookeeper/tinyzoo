<script setup lang="ts">
// Block "faq": the questions and answers. Drawn by components/<look>/Faq.vue.
defineProps<{ block: BlockOf<'faq'>; index?: number }>()
const items = await useQuestions()
</script>

<template>
  <LookPart part="Faq" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('faq')" />
</template>
