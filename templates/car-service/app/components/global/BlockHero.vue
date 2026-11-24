<script setup lang="ts">
// Block "hero": the opening. Drawn by components/<look>/Hero.vue, which reads today's hours, the
// next free day and the rates from the site's settings.
defineProps<{ block: BlockOf<'hero'>; index?: number }>()
</script>

<template>
  <LookPart part="Hero" :first="index === 0" :block="block" />
</template>
