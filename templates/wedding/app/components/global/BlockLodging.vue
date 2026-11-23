<script setup lang="ts">
// Block "lodging": the places to stay. Drawn by components/<look>/Lodging.vue.
defineProps<{ block: BlockOf<'lodging'>; index?: number }>()
const items = await useLodgings()
</script>

<template>
  <LookPart part="Lodging" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('lodging')" />
</template>
