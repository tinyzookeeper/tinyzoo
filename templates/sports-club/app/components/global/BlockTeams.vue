<script setup lang="ts">
// Block "teams": the teams with their competition, coach and training times. Drawn by components/<look>/Teams.vue.
defineProps<{ block: BlockOf<'teams'>; index?: number }>()
const squads = await useSquads()
</script>

<template>
  <LookPart part="Teams" :first="index === 0" :block="block" :squads="squads" :anchor="anchorOf('teams')" />
</template>
