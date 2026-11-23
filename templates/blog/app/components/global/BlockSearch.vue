<script setup lang="ts">
// Block "search" (cms.config.ts): the results of the header's search box, drawn by the site's look: components/<look>/Search.vue.
defineProps<{ block: BlockOf<'search'>; index?: number }>()

</script>

<template>
  <LookPart part="Search" :first="index === 0" :block="block" :anchor="anchorOf('search')" />
</template>
