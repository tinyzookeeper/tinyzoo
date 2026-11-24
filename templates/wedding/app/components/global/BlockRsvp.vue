<script setup lang="ts">
// Block "rsvp": the reply form (the Rsvp form of cms.config.ts). The replies arrive in the
// admin. Drawn by components/<look>/Rsvp.vue, its fields by <RsvpFields>.
defineProps<{ block: BlockOf<'rsvp'>; index?: number }>()
const form = await useSiteForm('rsvp', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Rsvp" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('rsvp')" />
</template>
