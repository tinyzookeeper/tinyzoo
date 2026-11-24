<script setup lang="ts">
// Block "hours": the week's opening hours. Drawn by components/<look>/Hours.vue.
defineProps<{ block: BlockOf<'hours'>; index?: number }>()
const hours = await useOpeningHours()
</script>

<template>
  <LookPart part="Hours" :first="index === 0" :block="block" :hours="hours" :anchor="anchorOf('hours')" />
</template>
