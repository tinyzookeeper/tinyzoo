<script setup lang="ts">
// Block "contact": the organiser's details and the contact form (the Enquiry form of
// cms.config.ts; the messages arrive in the admin). Drawn by components/<look>/Contact.vue.
defineProps<{ block: BlockOf<'contact'>; index?: number }>()
const form = await useSiteForm('enquiry', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Contact" :first="index === 0" :block="block" :form="form" />
</template>
