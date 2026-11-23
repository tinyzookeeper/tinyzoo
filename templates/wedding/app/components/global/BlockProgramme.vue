<script setup lang="ts">
// Block "programme": the items of the Programme collection in order. Drawn by components/<look>/Programme.vue.
defineProps<{ block: BlockOf<'programme'>; index?: number }>()
const items = await useProgramme()
</script>

<template>
  <LookPart part="Programme" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('programme')" />
</template>
