<script setup lang="ts">
// Block "hero" (cms.config.ts): the opening. It also gets the week's classes: Sál shows the
// one that starts next, Tabule today's. Drawn by components/<look>/Hero.vue.
defineProps<{ block: BlockOf<'hero'>; index?: number }>()
const { slots } = await useLessonSlots()
</script>

<template>
  <LookPart part="Hero" :first="index === 0" :block="block" :slots="slots" />
</template>
