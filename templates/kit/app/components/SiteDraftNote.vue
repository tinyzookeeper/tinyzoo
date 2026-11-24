<script setup lang="ts">
const words = useSiteWords()
</script>

<template>
  <p class="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">{{ words.draftPreview }}</p>
</template>
