<script setup lang="ts">
// Block "extras": what comes with a repair, the entries of Extras. Drawn by components/<look>/Extras.vue.
defineProps<{ block: BlockOf<'extras'>; index?: number }>()
const items = await useExtras()
</script>

<template>
  <LookPart part="Extras" :first="index === 0" :block="block" :items="items" />
</template>
