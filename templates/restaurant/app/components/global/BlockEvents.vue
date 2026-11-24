<script setup lang="ts">
// Block "events": the next events that have not ended. Drawn by components/<look>/Events.vue.
const props = defineProps<{ block: BlockOf<'events'>; index?: number }>()
const events = await useEvents()
const now = useNow()
const upcoming = computed(() => upcomingEvents(events.value, now.value, props.block.limit))
</script>

<template>
  <LookPart v-if="upcoming.length" part="Events" :first="index === 0" :block="block" :events="upcoming" :anchor="anchorOf('events')" />
</template>
