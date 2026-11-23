<script setup lang="ts">
// Block "contact": the office from Site settings and the towns the firm builds in. Drawn by
// components/<look>/Contact.vue.
defineProps<{ block: BlockOf<'contact'>; index?: number }>()
const towns = await useTowns()
</script>

<template>
  <LookPart part="Contact" :first="index === 0" :block="block" :towns="towns" :anchor="anchorOf('contact')" />
</template>
