<script setup lang="ts">
// Block "roster": the squad of the main team. Drawn by components/<look>/Roster.vue.
defineProps<{ block: BlockOf<'roster'>; index?: number }>()
const players = await usePlayers()
</script>

<template>
  <LookPart part="Roster" :first="index === 0" :block="block" :players="players" :anchor="anchorOf('roster')" />
</template>
