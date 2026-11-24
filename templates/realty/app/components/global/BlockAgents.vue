<script setup lang="ts">
// Block "agents": the people a client calls. Drawn by components/<look>/Agents.vue.
defineProps<{ block: BlockOf<'agents'>; index?: number }>()
const agents = await useAgents()
</script>

<template>
  <LookPart part="Agents" :first="index === 0" :block="block" :agents="agents" :anchor="anchorOf('agents')" />
</template>
