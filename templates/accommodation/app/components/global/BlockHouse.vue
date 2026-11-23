<script setup lang="ts">
// Block "house": what the house offers. Drawn by components/<look>/House.vue.
defineProps<{ block: BlockOf<'house'>; index?: number }>()
const features = await useFeatures()
</script>

<template>
  <LookPart part="House" :first="index === 0" :block="block" :features="features" :anchor="anchorOf('house')" />
</template>
