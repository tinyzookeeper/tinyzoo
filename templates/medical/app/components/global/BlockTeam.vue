<script setup lang="ts">
// Block "team": the doctors and nurses. Drawn by components/<look>/Team.vue.
defineProps<{ block: BlockOf<'team'>; index?: number }>()
const items = await useTeam()
</script>

<template>
  <LookPart part="Team" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('team')" />
</template>
