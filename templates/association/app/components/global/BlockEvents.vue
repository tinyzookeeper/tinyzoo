<script setup lang="ts">
// Block "events": the calendar, the nearest event large, and a look back. Drawn by components/<look>/Events.vue.
defineProps<{ block: BlockOf<'events'>; index?: number }>()
const events = await useEvents()
</script>

<template>
  <LookPart part="Events" :first="index === 0" :block="block" :events="events" :anchor="anchorOf('events')" />
</template>
