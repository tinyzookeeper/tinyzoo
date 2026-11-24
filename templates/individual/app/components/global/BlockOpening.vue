<script setup lang="ts">
// Block "opening" (cms.config.ts), drawn by the site's look: components/<look>/Opening.vue.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :anchor="anchorOf('opening')" />
</template>
