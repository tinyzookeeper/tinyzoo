<script setup lang="ts">
// Block "visit" (cms.config.ts), drawn by the site's look: components/<look>/Visit.vue. The hours
// and the address are Site settings, which the look reads itself.
defineProps<{ block: BlockOf<'visit'>; index?: number }>()
</script>

<template>
  <LookPart part="Visit" :first="index === 0" :block="block" :anchor="anchorOf('visit')" />
</template>
