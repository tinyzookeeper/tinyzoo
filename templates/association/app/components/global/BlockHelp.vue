<script setup lang="ts">
// Block "help": three ways to help, and what a sum pays for. Drawn by components/<look>/Help.vue.
defineProps<{ block: BlockOf<'help'>; index?: number }>()
const people = await usePeople()
</script>

<template>
  <LookPart part="Help" :first="index === 0" :block="block" :people="people" :anchor="anchorOf('help')" />
</template>
