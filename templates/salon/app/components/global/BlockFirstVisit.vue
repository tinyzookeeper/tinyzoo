<script setup lang="ts">
// Block "firstVisit" (cms.config.ts), drawn by the site's look: components/<look>/FirstVisit.vue.
defineProps<{ block: BlockOf<'firstVisit'>; index?: number }>()
</script>

<template>
  <LookPart part="FirstVisit" :first="index === 0" :block="block" :anchor="anchorOf('firstVisit')" />
</template>
