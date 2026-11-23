<script setup lang="ts">
// Block "team": the people, the entries of Team. Drawn by components/<look>/Team.vue.
defineProps<{ block: BlockOf<'team'>; index?: number }>()
const people = await useTeam()
</script>

<template>
  <LookPart part="Team" :first="index === 0" :block="block" :people="people" :anchor="anchorOf('team')" />
</template>
