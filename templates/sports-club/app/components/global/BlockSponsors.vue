<script setup lang="ts">
// Block "sponsors": the partners by level. Drawn by components/<look>/Sponsors.vue.
defineProps<{ block: BlockOf<'sponsors'>; index?: number }>()
const items = await useSponsors()
</script>

<template>
  <LookPart part="Sponsors" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('sponsors')" />
</template>
