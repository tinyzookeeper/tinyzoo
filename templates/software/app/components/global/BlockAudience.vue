<script setup lang="ts">
// Block "audience" (cms.config.ts), drawn by the site's look: components/<look>/Audience.vue.
defineProps<{ block: BlockOf<'audience'>; index?: number }>()

</script>

<template>
  <LookPart part="Audience" :first="index === 0" :block="block" :anchor="anchorOf('audience')" />
</template>
