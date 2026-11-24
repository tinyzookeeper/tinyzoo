<script setup lang="ts">
// Block "contact": where to find the association and the message form (the Contact form of
// cms.config.ts). The messages arrive in the admin. Drawn by components/<look>/Contact.vue.
defineProps<{ block: BlockOf<'contact'>; index?: number }>()
// All asked for before the first wait: after one, Nuxt no longer knows which request this is.
const [form, events] = await Promise.all([useSiteForm('contact', DEFAULT_LANGUAGE), useEvents()])
</script>

<template>
  <LookPart part="Contact" :first="index === 0" :block="block" :form="form" :events="events" :anchor="anchorOf('contact')" />
</template>
