<script setup lang="ts">
// Block "routes": the routes with their profiles, figures and places left. Drawn by components/<look>/Routes.vue.
defineProps<{ block: BlockOf<'routes'>; index?: number }>()
const tracks = await useTracks()
</script>

<template>
  <LookPart part="Routes" :first="index === 0" :block="block" :tracks="tracks" :anchor="anchorOf('routes')" />
</template>
