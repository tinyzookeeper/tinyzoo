<script setup lang="ts">
// Block "documents": every document by year, for the archive page. Drawn by components/<look>/Documents.vue.
defineProps<{ block: BlockOf<'documents'>; index?: number }>()
const documents = await useDocuments()
</script>

<template>
  <LookPart part="Documents" :first="index === 0" :block="block" :documents="documents" :anchor="anchorOf('documents')" />
</template>
