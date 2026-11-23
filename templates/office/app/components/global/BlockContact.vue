<script setup lang="ts">
// Block "contact": the enquiry form (the Enquiry form of cms.config.ts; the enquiries arrive in
// the admin), the office hours, the address. Drawn by components/<look>/Contact.vue, its fields by <EnquiryFields>.
defineProps<{ block: BlockOf<'contact'>; index?: number }>()
const form = await useSiteForm('enquiry', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Contact" :first="index === 0" :block="block" :anchor="anchorOf('contact')" :form="form" />
</template>
