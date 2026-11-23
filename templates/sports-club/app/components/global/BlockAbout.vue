<script setup lang="ts">
// Block "about": the club, its ground and its committee. Drawn by components/<look>/About.vue.
defineProps<{ block: BlockOf<'about'>; index?: number }>()
const committee = await useCommittee()
</script>

<template>
  <LookPart part="About" :first="index === 0" :block="block" :committee="committee" :anchor="anchorOf('about')" />
</template>
