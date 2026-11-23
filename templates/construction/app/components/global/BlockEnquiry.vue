<script setup lang="ts">
// Block "enquiry": what happens next, the phone and the form (the Enquiry form of cms.config.ts).
// The enquiries arrive in the admin. Drawn by components/<look>/Enquiry.vue, its fields by <EnquiryFields>.
defineProps<{ block: BlockOf<'enquiry'>; index?: number }>()
const form = await useSiteForm('enquiry', DEFAULT_LANGUAGE)
</script>

<template>
  <LookPart part="Enquiry" :first="index === 0" :block="block" :form="form" :anchor="anchorOf('enquiry')" />
</template>
